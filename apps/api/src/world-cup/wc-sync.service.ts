import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStatus, MatchdayStatus, TournamentPhase } from '@prisma/client';
import { PickProcessingService } from '../picks/pick-processing.service';

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const WC_COMPETITION_CODE = 'WC';
const WC_API_FOOTBALL_ID = 2000;
const WC_TEAM_ID_FACTOR = 1000000;
const WC_SEASON = 2026;
const WC_START_DATE = '2026-06-11';

const STAGE_TO_PHASE: Record<string, TournamentPhase> = {
  GROUP_STAGE:    TournamentPhase.GROUP_STAGE,
  ROUND_OF_32:   TournamentPhase.ROUND_OF_32,
  LAST_32:       TournamentPhase.ROUND_OF_32,
  ROUND_OF_16:   TournamentPhase.ROUND_OF_16,
  LAST_16:       TournamentPhase.ROUND_OF_16,
  QUARTER_FINALS: TournamentPhase.QUARTER_FINALS,
  SEMI_FINALS:   TournamentPhase.SEMI_FINALS,
  THIRD_PLACE:   TournamentPhase.THIRD_PLACE,
  FINAL:         TournamentPhase.FINAL,
};

const FD_STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: MatchStatus.SCHEDULED,
  TIMED:     MatchStatus.SCHEDULED,
  LIVE:      MatchStatus.LIVE,
  IN_PLAY:   MatchStatus.LIVE,
  PAUSED:    MatchStatus.LIVE,
  FINISHED:  MatchStatus.FINISHED,
  POSTPONED: MatchStatus.POSTPONED,
  CANCELLED: MatchStatus.CANCELLED,
  SUSPENDED: MatchStatus.CANCELLED,
};

@Injectable()
export class WcSyncService {
  private readonly logger = new Logger(WcSyncService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PickProcessingService))
    private readonly pickProcessing: PickProcessingService,
  ) {}

  private get headers() {
    const token = this.config.get<string>('FOOTBALL_DATA_ORG_TOKEN', '');
    return token ? { 'X-Auth-Token': token } : {};
  }

  private async fdGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const res: AxiosResponse<T> = await firstValueFrom(
      this.http.get<T>(`${FOOTBALL_DATA_BASE}${path}`, { headers: this.headers, params }),
    );
    return res.data;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private dayNumber(kickoff: Date): number {
    // Use CEST midnight (UTC+2) as day boundary: June 11 00:00 CEST = June 10 22:00 UTC.
    // Matches at 22:00–23:59 UTC belong to the NEXT calendar day in Spain.
    const startCest = new Date('2026-06-10T22:00:00.000Z').getTime();
    return Math.max(1, Math.floor((kickoff.getTime() - startCest) / 86400000) + 1);
  }

  private resolveWinner(
    homeScore: number | null,
    awayScore: number | null,
    homeTeamId: string,
    awayTeamId: string,
  ): string | null {
    if (homeScore === null || awayScore === null) return null;
    if (homeScore > awayScore) return homeTeamId;
    if (awayScore > homeScore) return awayTeamId;
    return null;
  }

  // ── Ensure WC league row exists ────────────────────────────────────────────

  async ensureWcLeague(): Promise<{ id: string }> {
    const existing = await this.prisma.footballLeague.findUnique({
      where: { apiFootballId: WC_API_FOOTBALL_ID },
    });
    if (existing) return existing;

    return this.prisma.footballLeague.create({
      data: {
        name: 'FIFA World Cup',
        country: 'World',
        apiFootballId: WC_API_FOOTBALL_ID,
        totalMatchdaysPerSeason: 64,
        currentSeason: WC_SEASON,
      },
    });
  }

  // ── Sync 48 national teams ─────────────────────────────────────────────────

  async syncWcTeams(): Promise<void> {
    const league = await this.ensureWcLeague();

    try {
      const data: any = await this.fdGet(`/competitions/${WC_COMPETITION_CODE}/teams`, {
        season: WC_SEASON,
      });
      const teams: any[] = data?.teams ?? [];

      if (teams.length === 0) {
        this.logger.warn('WC teams: 0 returned — tournament draw may not be available yet');
        return;
      }

      this.logger.log(`Syncing ${teams.length} WC teams...`);

      for (const t of teams) {
        const apiId = WC_API_FOOTBALL_ID * WC_TEAM_ID_FACTOR + t.id;
        await this.prisma.footballTeam.upsert({
          where: { apiFootballId: apiId },
          update: { name: t.name, logoUrl: t.crest ?? '' },
          create: { leagueId: league.id, apiFootballId: apiId, name: t.name, logoUrl: t.crest ?? '' },
        });
      }

      this.logger.log(`WC teams synced: ${teams.length}`);
    } catch (err) {
      this.logger.error(`syncWcTeams failed: ${(err as Error).message}`);
    }
  }

  // ── Sync full match calendar (group stage + knockout) ─────────────────────

  async syncWcMatches(): Promise<void> {
    const league = await this.ensureWcLeague();

    try {
      const data: any = await this.fdGet(`/competitions/${WC_COMPETITION_CODE}/matches`, {
        season: WC_SEASON,
      });
      const matches: any[] = data?.matches ?? [];

      if (matches.length === 0) {
        this.logger.warn('WC matches: 0 returned');
        return;
      }

      this.logger.log(`Syncing ${matches.length} WC matches...`);
      let upserted = 0;

      for (const m of matches) {
        // Knockout TBD slots have null team IDs — skip until draw is confirmed
        if (!m.homeTeam?.id || !m.awayTeam?.id) continue;

        const phase = STAGE_TO_PHASE[m.stage] ?? null;
        const wcGroup = m.group ? (m.group as string).replace('GROUP_', '') : null;
        const kickoff = new Date(m.utcDate);
        const dayNum = this.dayNumber(kickoff);

        const matchday = await this.prisma.matchday.upsert({
          where: { leagueId_season_number: { leagueId: league.id, season: WC_SEASON, number: dayNum } },
          update: { tournamentPhase: phase, wcGroupDay: m.matchday ?? null },
          create: {
            leagueId: league.id,
            season: WC_SEASON,
            number: dayNum,
            tournamentPhase: phase,
            wcGroupDay: m.matchday ?? null,
            firstKickoff: kickoff,
          },
        });

        // Keep firstKickoff as the earliest match of the day (API may not return matches in order)
        if (!matchday.firstKickoff || kickoff < matchday.firstKickoff) {
          await this.prisma.matchday.update({
            where: { id: matchday.id },
            data: { firstKickoff: kickoff },
          });
        }

        const homeApiId = WC_API_FOOTBALL_ID * WC_TEAM_ID_FACTOR + m.homeTeam.id;
        const awayApiId = WC_API_FOOTBALL_ID * WC_TEAM_ID_FACTOR + m.awayTeam.id;
        const [home, away] = await Promise.all([
          this.prisma.footballTeam.findUnique({ where: { apiFootballId: homeApiId } }),
          this.prisma.footballTeam.findUnique({ where: { apiFootballId: awayApiId } }),
        ]);

        if (!home || !away) {
          this.logger.warn(`Teams not found for match ${m.id} — run syncWcTeams first`);
          continue;
        }

        const status = FD_STATUS_MAP[m.status] ?? MatchStatus.SCHEDULED;
        const homeScore: number | null = m.score?.fullTime?.home ?? null;
        const awayScore: number | null = m.score?.fullTime?.away ?? null;
        const winnerTeamId = this.resolveWinner(homeScore, awayScore, home.id, away.id);

        await this.prisma.match.upsert({
          where: { apiFootballFixtureId: m.id },
          update: { matchdayId: matchday.id, status, homeScore, awayScore, winnerTeamId, tournamentPhase: phase, wcGroup },
          create: {
            matchdayId: matchday.id,
            homeTeamId: home.id,
            awayTeamId: away.id,
            winnerTeamId,
            kickoffTime: kickoff,
            homeScore,
            awayScore,
            status,
            apiFootballFixtureId: m.id,
            tournamentPhase: phase,
            wcGroup,
          },
        });

        upserted++;
      }

      await this.recalcFirstKickoffs(league.id);
      this.logger.log(`WC matches sync complete: ${upserted} upserted`);
    } catch (err) {
      this.logger.error(`syncWcMatches failed: ${(err as Error).message}`);
    }
  }

  private async recalcFirstKickoffs(leagueId: string): Promise<void> {
    const matchdays = await this.prisma.matchday.findMany({
      where: { leagueId, season: WC_SEASON },
      include: {
        matches: { select: { kickoffTime: true }, orderBy: { kickoffTime: 'asc' }, take: 1 },
      },
    });
    for (const md of matchdays) {
      const earliest = md.matches[0]?.kickoffTime ?? null;
      if (earliest && md.firstKickoff?.getTime() !== earliest.getTime()) {
        await this.prisma.matchday.update({ where: { id: md.id }, data: { firstKickoff: earliest } });
      }
    }
  }

  // ── Sync group standings ───────────────────────────────────────────────────

  async syncWcStandings(): Promise<void> {
    const league = await this.ensureWcLeague();

    try {
      const data: any = await this.fdGet(`/competitions/${WC_COMPETITION_CODE}/standings`, {
        season: WC_SEASON,
      });
      const standings: any[] = data?.standings ?? [];

      for (const groupData of standings) {
        if (groupData.stage !== 'GROUP_STAGE') continue;
        if (!groupData.group) continue;

        const groupName: string = (groupData.group as string).replace('GROUP_', '');

        const wcGroup = await this.prisma.wcGroup.upsert({
          where: { leagueId_season_name: { leagueId: league.id, season: WC_SEASON, name: groupName } },
          update: {},
          create: { leagueId: league.id, season: WC_SEASON, name: groupName },
        });

        for (const row of groupData.table ?? []) {
          const teamApiId = WC_API_FOOTBALL_ID * WC_TEAM_ID_FACTOR + row.team.id;
          const team = await this.prisma.footballTeam.findUnique({ where: { apiFootballId: teamApiId } });
          if (!team) continue;

          await this.prisma.wcGroupStanding.upsert({
            where: { groupId_teamId: { groupId: wcGroup.id, teamId: team.id } },
            update: {
              position:     row.position,
              played:       row.playedGames,
              won:          row.won,
              drawn:        row.draw,
              lost:         row.lost,
              goalsFor:     row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              points:       row.points,
            },
            create: {
              groupId:      wcGroup.id,
              teamId:       team.id,
              position:     row.position,
              played:       row.playedGames,
              won:          row.won,
              drawn:        row.draw,
              lost:         row.lost,
              goalsFor:     row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              points:       row.points,
            },
          });
        }
      }

      this.logger.log('WC standings synced');
    } catch (err) {
      this.logger.error(`syncWcStandings failed: ${(err as Error).message}`);
    }
  }

  // ── Process finished matches → resolve picks ───────────────────────────────

  async processFinishedWcMatches(): Promise<void> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const today = new Date();

    try {
      const data: any = await this.fdGet(`/competitions/${WC_COMPETITION_CODE}/matches`, {
        season:   WC_SEASON,
        status:   'FINISHED',
        dateFrom: since.toISOString().split('T')[0],
        dateTo:   today.toISOString().split('T')[0],
      });
      const matches: any[] = data?.matches ?? [];

      if (matches.length === 0) return;

      this.logger.log(`Processing ${matches.length} finished WC matches...`);

      for (const m of matches) {
        const existing = await this.prisma.match.findUnique({
          where: { apiFootballFixtureId: m.id },
        });
        if (!existing) continue;

        // Skip if API still has null scores — fullTime scores may lag a few seconds after FINISHED status.
        // Never process as 0-0 when scores aren't available yet.
        const homeScore = m.score?.fullTime?.home;
        const awayScore = m.score?.fullTime?.away;
        if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
          this.logger.warn(`WC match ${m.id}: FINISHED but null scores — skipping until scores are available`);
          continue;
        }

        const winnerTeamId = this.resolveWinner(homeScore, awayScore, existing.homeTeamId, existing.awayTeamId);

        // Skip if already FINISHED with the correct result
        if (existing.status === MatchStatus.FINISHED && existing.winnerTeamId === winnerTeamId) continue;

        await this.prisma.match.update({
          where: { id: existing.id },
          data: { status: MatchStatus.FINISHED, homeScore, awayScore, winnerTeamId },
        });

        await this.pickProcessing.processMatchResult(existing.id);
        this.logger.log(`WC match ${m.id} resolved: ${homeScore}–${awayScore}`);
      }

      await this.markCompletedMatchdays();
    } catch (err) {
      this.logger.error(`processFinishedWcMatches failed: ${(err as Error).message}`);
    }
  }

  private async markCompletedMatchdays(): Promise<void> {
    const pending = await this.prisma.matchday.findMany({
      where: {
        status: { not: MatchdayStatus.FINISHED },
        league: { apiFootballId: WC_API_FOOTBALL_ID },
        matches: { some: {} },
      },
      include: { matches: { select: { status: true } } },
    });

    const terminal = new Set<MatchStatus>([
      MatchStatus.FINISHED,
      MatchStatus.CANCELLED,
      MatchStatus.POSTPONED,
    ]);

    for (const md of pending) {
      if (md.matches.every((m) => terminal.has(m.status))) {
        await this.prisma.matchday.update({
          where: { id: md.id },
          data: { status: MatchdayStatus.FINISHED },
        });
      }
    }
  }
}
