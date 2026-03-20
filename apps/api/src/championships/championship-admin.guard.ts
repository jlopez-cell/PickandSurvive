import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChampionshipAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const championshipId = request.params?.id;

    if (!userId || !championshipId) {
      throw new ForbiddenException('Acceso denegado');
    }

    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      select: { adminId: true },
    });

    if (!championship) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    if (championship.adminId !== userId) {
      throw new ForbiddenException('Solo el admin del campeonato puede realizar esta acción');
    }

    return true;
  }
}
