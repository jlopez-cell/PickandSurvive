import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async register(dto: RegisterDto) {
    const [emailExists, aliasExists] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.user.findUnique({ where: { alias: dto.alias } }),
    ]);

    if (emailExists) throw new ConflictException('Email ya en uso');
    if (aliasExists) throw new ConflictException('Alias ya en uso');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = uuidv4();
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        alias: dto.alias,
        verificationToken,
        verificationTokenExpiresAt,
        notificationPrefs: { create: {} },
      },
    });

    await this.sendVerificationEmail(dto.email, verificationToken);

    return { message: 'Registro exitoso. Revisa tu email para verificar tu cuenta.' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({ where: { verificationToken: token } });

    if (!user) throw new NotFoundException('Token inválido o ya utilizado');
    if (user.emailVerified) return { message: 'Email ya verificado' };
    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new ForbiddenException('Token expirado. Solicita un nuevo email de verificación en /auth/resend-verification');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    return { message: 'Email verificado correctamente. Ya puedes iniciar sesión.' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (!user.emailVerified) {
      await this.resendVerification(dto.email);
      throw new ForbiddenException('Verifica tu email antes de iniciar sesión. Te hemos reenviado el enlace.');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      alias: user.alias,
      role: user.role,
    });

    return { accessToken };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return same message to avoid email enumeration
    if (!user || user.emailVerified) {
      return { message: 'Si el email existe y no está verificado, recibirás un nuevo enlace.' };
    }

    const verificationToken = uuidv4();
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiresAt },
    });

    await this.sendVerificationEmail(user.email, verificationToken);

    return { message: 'Si el email existe y no está verificado, recibirás un nuevo enlace.' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, alias: true, role: true, emailVerified: true, createdAt: true },
    });

    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async sendVerificationEmail(email: string, token: string) {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    // Always log the link so development works without email setup
    console.log(`\n[DEV] Verification link for ${email}:\n${verifyUrl}\n`);

    const emailProvider = (this.configService.get<string>('EMAIL_PROVIDER', 'resend') ?? 'resend').toLowerCase();
    const subject = 'Verifica tu email — Pick & Survive';
    const html = `
      <h2>Bienvenido a Pick & Survive</h2>
      <p>Haz clic en el siguiente enlace para verificar tu cuenta:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no has creado una cuenta, ignora este email.</p>
    `;

    const sendViaResend = async () => {
      const result = await this.resend.emails.send({
        from: 'Pick & Survive <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      });
      if ((result as any)?.error) {
        throw new Error((result as any).error.message ?? 'Resend error');
      }
    };

    const sendViaGmail = async () => {
      const gmailUser = this.configService.get<string>('GMAIL_SMTP_USER');
      const gmailPass = this.configService.get<string>('GMAIL_SMTP_PASS');
      if (!gmailUser || !gmailPass) throw new Error('Faltan credenciales SMTP de Gmail');

      const host = this.configService.get<string>('GMAIL_SMTP_HOST', 'smtp.gmail.com');
      const port = Number(this.configService.get<string>('GMAIL_SMTP_PORT', '465'));
      const secureRaw = this.configService.get<string>('GMAIL_SMTP_SECURE', String(port === 465));
      const secure = secureRaw === 'true' || port === 465;
      const fromEmail = this.configService.get<string>('GMAIL_FROM_EMAIL', gmailUser);
      const fromName = this.configService.get<string>('GMAIL_FROM_NAME', 'Pick & Survive');

      const transport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transport.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject,
        html,
      });
    };

    try {
      if (emailProvider === 'gmail') {
        await sendViaGmail();
      } else if (emailProvider === 'resend') {
        await sendViaResend();
      } else {
        try {
          await sendViaResend();
        } catch (resendErr) {
          console.warn('Resend verificación falló, pasando a Gmail:', (resendErr as Error)?.message);
          await sendViaGmail();
        }
      }
    } catch (err) {
      console.error('Failed to send verification email:', (err as Error)?.message);
    }
  }
}
