import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FootballDataService } from '../football/football-data.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly footballData: FootballDataService,
  ) {}

  async getLeagues() {
    return this.prisma.footballLeague.findMany({
      include: { _count: { select: { teams: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createLeague(dto: CreateLeagueDto) {
    return this.prisma.footballLeague.create({
      data: {
        name: dto.name,
        country: dto.country,
        apiFootballId: dto.apiFootballId,
        totalMatchdaysPerSeason: dto.totalMatchdaysPerSeason,
        currentSeason: dto.currentSeason,
      },
    });
  }

  async updateLeague(id: string, dto: UpdateLeagueDto) {
    const league = await this.prisma.footballLeague.findUnique({ where: { id } });
    if (!league) throw new NotFoundException('Liga no encontrada');
    return this.prisma.footballLeague.update({ where: { id }, data: dto });
  }

  async getTeamsByLeague(id: string) {
    const league = await this.prisma.footballLeague.findUnique({ where: { id } });
    if (!league) throw new NotFoundException('Liga no encontrada');
    return this.prisma.footballTeam.findMany({
      where: { leagueId: id },
      orderBy: { name: 'asc' },
    });
  }

  async syncLeague(id: string) {
    const league = await this.prisma.footballLeague.findUnique({ where: { id } });
    if (!league) throw new NotFoundException('Liga no encontrada');
    await this.footballData.syncLeagueTeams(id);
    return { message: `Sync iniciado para ${league.name}` };
  }

  async syncFixtures() {
    const leagues = await this.prisma.footballLeague.findMany();
    for (const league of leagues) {
      await this.footballData.syncLeagueTeams(league.id);
    }
    await this.footballData.syncUpcomingFixtures();
    return { message: 'Fixtures sincronizados correctamente' };
  }

  async getSystemStatus() {
    const [leagues, teams, matchdays, matches] = await Promise.all([
      this.prisma.footballLeague.count(),
      this.prisma.footballTeam.count(),
      this.prisma.matchday.count(),
      this.prisma.match.count(),
    ]);
    return { leagues, teams, matchdays, matches };
  }
}
