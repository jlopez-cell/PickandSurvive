import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));

    const vapidPublic = this.config.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivate = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(
        'mailto:noreply@pickandsurvive.com',
        vapidPublic,
        vapidPrivate,
      );
    }
  }

  async send(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>,
    emailContent?: { subject: string; html: string },
  ) {
    // Create DB record
    const notification = await this.prisma.notification.create({
      data: { userId, type, payload: payload as any },
    });

    // Get user prefs
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { notificationPrefs: true },
    });
    if (!user) return notification;

    const prefs = user.notificationPrefs;

    // Email
    if (prefs?.emailEnabled !== false && emailContent) {
      try {
        await this.resend.emails.send({
          from: 'Pick & Survive <noreply@pickandsurvive.com>',
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { sentEmail: true },
        });
      } catch (err) {
        this.logger.error(`Email send failed for user ${userId}: ${(err as Error).message}`);
      }
    }

    // Web Push
    if (prefs?.pushEnabled && prefs.pushSubscriptionJson) {
      try {
        const subscription = JSON.parse(prefs.pushSubscriptionJson);
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ type, payload }),
        );
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { sentPush: true },
        });
      } catch (err) {
        this.logger.error(`Push send failed for user ${userId}: ${(err as Error).message}`);
        // EC-32: clear invalid subscription
        if ((err as any).statusCode === 410) {
          await this.prisma.userNotificationPrefs.update({
            where: { userId },
            data: { pushSubscriptionJson: null, pushEnabled: false },
          });
        }
      }
    }

    return notification;
  }

  // ─── User-facing endpoints ────────────────────────────────────────────────

  async getNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, total, page, limit };
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  async getPrefs(userId: string) {
    return this.prisma.userNotificationPrefs.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updatePrefs(
    userId: string,
    data: { emailEnabled?: boolean; pushEnabled?: boolean; pushSubscriptionJson?: string | null },
  ) {
    return this.prisma.userNotificationPrefs.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
