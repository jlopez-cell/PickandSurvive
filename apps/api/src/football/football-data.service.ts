import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStatus } from '@prisma/client';
import { PickProcessingService } from '../picks/pick-processing.service';

const API_BASE = 'https://v3.football.api-sports.io';
const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
// football-data usa IDs de clubes globales (reutilizados entre competiciones).
// Como nuestro schema tiene `FootballTeam.apiFootballId` @unique y además liga por `leagueId`,
// derivamos el ID por (competicion, club) para evitar colisiones entre ligas.
const FOOTBALL_DATA_TEAM_ID_FACTOR = 1000000;

/** Solo Primera División (nombre en seed). Evita 429 consultando todas las competiciones. */
const SYNC_FIXTURES_LEAGUE_NAME = 'LaLiga';

// Mapping from API-Football status codes to our MatchStatus enum
const MATCH_STATUS_MAP: Record<string, MatchStatus> = {
  NS: MatchStatus.SCHEDULED,
  '1H': MatchStatus.LIVE,
  HT: MatchStatus.LIVE,
  '2H': MatchStatus.LIVE,
  ET: MatchStatus.LIVE,
  P: MatchStatus.LIVE,
  FT: MatchStatus.FINISHED,
  AET: MatchStatus.FINISHED,
  PEN: MatchStatus.FINISHED,
  PST: MatchStatus.POSTPONED,
  CANC: MatchStatus.CANCELLED,
  ABD: MatchStatus.CANCELLED,
  AWD: MatchStatus.FINISHED,
  WO: MatchStatus.FINISHED,
};

// Mapping de football-data.org → MatchStatus
const FOOTBALL_DATA_MATCH_STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: MatchStatus.SCHEDULED,
  TIMED: MatchStatus.SCHEDULED,
  LIVE: MatchStatus.LIVE,
  IN_PLAY: MatchStatus.LIVE,
  PAUSED: MatchStatus.LIVE,
  FINISHED: MatchStatus.FINISHED,
  POSTPONED: MatchStatus.POSTPONED,
  CANCELLED: MatchStatus.CANCELLED,
  SUSPENDED: MatchStatus.CANCELLED,
};

@Injectable()
export class FootballDataService {
  private readonly logger = new Logger(FootballDataService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PickProcessingService))
    private readonly pickProcessing: PickProcessingService,
  ) {}

  private get headers() {
    return {
      'x-apisports-key': this.config.get<string>('API_FOOTBALL_KEY', ''),
    };
  }

  private get footballDataHeaders() {
    const token = this.config.get<string>('FOOTBALL_DATA_ORG_TOKEN', '');
    return token ? { 'X-Auth-Token': token } : {};
  }

  private isFootballDataEnabled() {
    return !!this.config.get<string>('FOOTBALL_DATA_ORG_TOKEN', '');
  }

  private async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const response: AxiosResponse<T> = await firstValueFrom(
      this.http.get<T>(`${API_BASE}${path}`, { headers: this.headers, params }),
    );
    return response.data;
  }

  private async footballDataGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const response: AxiosResponse<T> = await firstValueFrom(
      this.http.get<T>(`${FOOTBALL_DATA_BASE}${path}`, {
        headers: this.footballDataHeaders,
        params,
      }),
    );
    return response.data;
  }

  private formatDate(date: Date) {
    return date.toISOString().split('T')[0];
  }

  // ─── Sync Teams & League ────────────────────────────────────────────────────

  async syncLeagueTeams(leagueId: string) {
    const league = await this.prisma.footballLeague.findUnique({ where: { id: leagueId } });
    if (!league) {
      this.logger.warn(`League ${leagueId} not found`);
      return;
    }

    this.logger.log(`Syncing teams for league ${league.name} (season ${league.currentSeason})...`);

    // ── Provider: football-data.org (si está configurado) ─────────────────────
    if (this.isFootballDataEnabled()) {
      try {
        const fdData: any = await this.footballDataGet(`/competitions/${league.apiFootballId}/teams`, {
          season: league.currentSeason,
          // En v4 normalmente devuelve todas y no hace falta paginar para equipos.
          limit: 200,
        });
        const fdTeams: any[] = fdData?.teams ?? [];

        if (fdTeams.length === 0) {
          throw new Error('0 teams returned by football-data');
        }

        this.logger.log(`Fetched ${fdTeams.length} teams (football-data.org)`);

        for (const t of fdTeams) {
          // ID único por (competicion, club) para evitar colisiones entre ligas.
          const teamId: number = league.apiFootballId * FOOTBALL_DATA_TEAM_ID_FACTOR + t.id;
          await this.prisma.footballTeam.upsert({
            where: { apiFootballId: teamId },
            update: { name: t.name, logoUrl: t.crest ?? '', leagueId },
            create: {
              leagueId,
              apiFootballId: teamId,
              name: t.name,
              logoUrl: t.crest ?? '',
            },
          });
        }

        return;
      } catch (err) {
        this.logger.warn(
          `football-data.org teams failed for ${league.name} (apiFootballId=${league.apiFootballId}). Fallback to api-football. Error: ${(err as Error).message}`,
        );
      }
    }

    let data: any;
    try {
      data = await this.get('/teams', {
        league: league.apiFootballId,
        season: league.currentSeason,
      });
    } catch (err) {
      this.logger.error(`Failed to fetch teams: ${(err as Error).message}`);
      return;
    }

    let teams: any[] = data?.response ?? [];
    // A veces la API devuelve 0 equipos para el "season" si no coincide con el formato/temporada esperada.
    // Reintentamos sin `season` para conseguir los equipos igualmente.
    if (teams.length === 0) {
      this.logger.warn(
        `Fetched 0 teams for ${league.name} with season=${league.currentSeason}. Retrying without season...`,
      );
      try {
        data = await this.get('/teams', { league: league.apiFootballId });
        teams = data?.response ?? [];
      } catch (err) {
        this.logger.error(`Failed to fetch teams (retry without season): ${(err as Error).message}`);
        return;
      }
    }

    // Fallback adicional: para algunas temporadas, /teams devuelve 0.
    // Probamos con la temporada anterior para seguir teniendo equipos.
    if (teams.length === 0) {
      const prevSeason = league.currentSeason - 1;
      if (prevSeason >= 0) {
        this.logger.warn(
          `Fetched 0 teams for ${league.name} even after retry without season. Retrying with season=${prevSeason}...`,
        );
        try {
          data = await this.get('/teams', {
            league: league.apiFootballId,
            season: prevSeason,
          });
          teams = data?.response ?? [];
        } catch (err) {
          this.logger.error(
            `Failed to fetch teams (retry season=${prevSeason}): ${(err as Error).message}`,
          );
          return;
        }
      }
    }

    this.logger.log(`Fetched ${teams.length} teams`);

    for (const item of teams) {
      const t = item.team;
      await this.prisma.footballTeam.upsert({
        where: { apiFootballId: t.id },
        // Importante: si ya existían equipos (por la unicidad de apiFootballId),
        // reasignamos el leagueId al de la sincronizacion actual para que el selector
        // de equipos por liga se rellene correctamente.
        update: { name: t.name, logoUrl: t.logo ?? '', leagueId },
        create: {
          leagueId,
          apiFootballId: t.id,
          name: t.name,
          logoUrl: t.logo ?? '',
        },
      });
    }
  }

  // ─── Sync Upcoming Fixtures (daily cron) ────────────────────────────────────

  async syncUpcomingFixtures() {
    this.logger.log('Syncing upcoming fixtures...');

    const leagues = await this.prisma.footballLeague.findMany({
      where: { name: SYNC_FIXTURES_LEAGUE_NAME },
    });

    if (leagues.length === 0) {
      this.logger.warn(
        `No hay liga "${SYNC_FIXTURES_LEAGUE_NAME}" en BD; syncUpcomingFixtures omitido.`,
      );
      return;
    }

    for (const league of leagues) {
      // ── Provider: football-data.org (si está configurado) ────────────────
      if (this.isFootballDataEnabled()) {
        try {
          const today = new Date();
          const from = new Date(today.getTime());
          from.setDate(from.getDate() - 7);
          const to = new Date(today.getTime());
          to.setDate(to.getDate() + 60);

          const dateFrom = this.formatDate(from);
          const dateTo = this.formatDate(to);

          const fdData: any = await this.footballDataGet(
            `/competitions/${league.apiFootballId}/matches`,
            {
              season: league.currentSeason,
              dateFrom,
              dateTo,
              limit: 500,
              offset: 0,
            },
          );

          const fdMatches: any[] = fdData?.matches ?? [];
          if (fdMatches.length === 0) {
            throw new Error('0 matches returned by football-data');
          }

          for (const m of fdMatches) {
            await this.upsertFootballDataMatch(m, league.id, league.apiFootballId, league.currentSeason);
          }

          this.logger.log(`Fetched ${fdMatches.length} matches for ${league.name} (football-data.org)`);
          continue;
        } catch (err) {
          this.logger.warn(
            `football-data.org matches failed for ${league.name} (apiFootballId=${league.apiFootballId}). Fallback to api-football. Error: ${
              (err as Error).message
            }`,
          );
        }
      }

      let data: any;
      try {
        data = await this.get('/fixtures', {
          league: league.apiFootballId,
          season: league.currentSeason,
          next: 30,
        });

        // Si no hay fixtures "próximos" (por ejemplo, porque la temporada ya terminó
        // o el rango `next` no devuelve nada), hacemos un fallback por rango de fechas
        // de la temporada para que existan partidos en BD.
        if ((data?.response ?? []).length === 0) {
          this.logger.warn(
            `No se encontraron fixtures con next=30 para ${league.name} (season ${league.currentSeason}). Reintentando por rango de fechas...`,
          );

          try {
            // Nota: el filtro `season` en /leagues a veces devuelve vacío para algunos leagues.
            // Por eso consultamos sin `season` y extraemos el rango (start/end) de la temporada actual.
            const leaguesData: any = await this.get('/leagues', {
              country: league.country,
            });

            const apiLeague = leaguesData?.response?.find((x: any) => x.league?.id === league.apiFootballId);
            const seasonInfo =
              apiLeague?.seasons?.find((s: any) => s.year === league.currentSeason) ??
              apiLeague?.seasons?.find((s: any) => s.current) ??
              apiLeague?.seasons?.[0];

            const from = seasonInfo?.start;
            const to = seasonInfo?.end;

            if (from && to) {
              data = await this.get('/fixtures', {
                league: league.apiFootballId,
                season: league.currentSeason,
                from,
                to,
              });
            }
          } catch (err2) {
            this.logger.error(
              `Retry by date-range failed for ${league.name}: ${(err2 as Error).message}`,
            );
          }
        }
      } catch (err) {
        this.logger.error(`Failed to fetch fixtures for ${league.name}: ${(err as Error).message}`);
        continue;
      }

      let targetSeason = league.currentSeason;
      let fixtures: any[] = data?.response ?? [];

      // Si la API no devuelve fixtures para la temporada actual (ej. LaLiga 25/26 en este entorno),
      // intentamos con la temporada anterior para que el calendario no quede vacío.
      if (fixtures.length === 0 && targetSeason > 0) {
        const prevSeason = targetSeason - 1;
        this.logger.warn(
          `No fixtures found for ${league.name} season=${targetSeason}. Retrying with season=${prevSeason}...`,
        );

        try {
          let prevData: any = await this.get('/fixtures', {
            league: league.apiFootballId,
            season: prevSeason,
            next: 30,
          });

          let prevFixtures: any[] = prevData?.response ?? [];

          if (prevFixtures.length === 0) {
            const leaguesData: any = await this.get('/leagues', { country: league.country });
            const apiLeague = leaguesData?.response?.find((x: any) => x.league?.id === league.apiFootballId);
            const seasonInfo =
              apiLeague?.seasons?.find((s: any) => s.year === prevSeason) ??
              apiLeague?.seasons?.find((s: any) => s.current) ??
              apiLeague?.seasons?.[0];

            const from = seasonInfo?.start;
            const to = seasonInfo?.end;

            if (from && to) {
              prevData = await this.get('/fixtures', {
                league: league.apiFootballId,
                season: prevSeason,
                from,
                to,
              });
              prevFixtures = prevData?.response ?? [];
            }
          }

          if (prevFixtures.length > 0) {
            // Alineamos el season en BD con el season realmente disponible.
            await this.prisma.footballLeague.update({
              where: { id: league.id },
              data: { currentSeason: prevSeason },
            });

            targetSeason = prevSeason;
            fixtures = prevFixtures;
          }
        } catch (err) {
          this.logger.error(
            `Retry fixtures season=${prevSeason} failed for ${league.name}: ${(err as Error).message}`,
          );
        }
      }

      for (const fixture of fixtures) {
        await this.upsertFixture(fixture, league.id, targetSeason);
      }
    }

    this.logger.log('Fixture sync complete');
  }

  // ─── Process Finished Matches (5-min cron) ──────────────────────────────────

  async processFinishedMatches() {
    const today = new Date().toISOString().split('T')[0];

    const leagues = await this.prisma.footballLeague.findMany({
      where: { name: SYNC_FIXTURES_LEAGUE_NAME },
    });

    if (leagues.length === 0) {
      this.logger.warn(
        `No hay liga "${SYNC_FIXTURES_LEAGUE_NAME}" en BD; processFinishedMatches omitido.`,
      );
      return;
    }

    for (const league of leagues) {
      // ── Provider: football-data.org ─────────────────────────────────────────
      if (this.isFootballDataEnabled()) {
        try {
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - 2);
          const dateFrom = this.formatDate(fromDate);
          const dateTo = today;

          const fdData: any = await this.footballDataGet(
            `/competitions/${league.apiFootballId}/matches`,
            {
              season: league.currentSeason,
              dateFrom,
              dateTo,
              status: 'FINISHED',
              limit: 500,
              offset: 0,
            },
          );

          const fdMatches: any[] = fdData?.matches ?? [];
          for (const m of fdMatches) {
            await this.processFinishedFootballDataMatch(m);
          }

          if (fdMatches.length > 0) {
            this.logger.log(`Processed ${fdMatches.length} finished matches for ${league.name} (football-data.org)`);
          }

          continue;
        } catch (err) {
          this.logger.warn(
            `football-data.org processFinishedMatches failed for ${league.name} (apiFootballId=${league.apiFootballId}). Fallback to api-football. Error: ${
              (err as Error).message
            }`,
          );
        }
      }

      let data: any;
      try {
        data = await this.get('/fixtures', {
          league: league.apiFootballId,
          season: league.currentSeason,
          date: today,
          status: 'FT-AET-PEN',
        });
      } catch (err) {
        this.logger.error(
          `Failed to fetch results for ${league.name}: ${(err as Error).message}`,
        );
        continue;
      }

      const fixtures: any[] = data?.response ?? [];

      for (const fixture of fixtures) {
        try {
          await this.processFinishedFixture(fixture, league.id, league.currentSeason);
        } catch (err) {
          this.logger.error(
            `Error processing fixture ${fixture.fixture?.id}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async upsertFootballDataMatch(match: any, leagueId: string, leagueApiFootballId: number, season: number) {
    const fixtureId: number = match.id;
    const matchdayNumber: number = match.matchday ?? 0;

    if (!matchdayNumber) return;

    const kickoffTime = new Date(match.utcDate);
    const apiStatus: string = match.status ?? 'SCHEDULED';
    const matchStatus: MatchStatus = FOOTBALL_DATA_MATCH_STATUS_MAP[apiStatus] ?? MatchStatus.SCHEDULED;

    const homeScore: number | null =
      match.score?.fullTime?.home !== undefined && match.score?.fullTime?.home !== null
        ? Number(match.score.fullTime.home)
        : null;
    const awayScore: number | null =
      match.score?.fullTime?.away !== undefined && match.score?.fullTime?.away !== null
        ? Number(match.score.fullTime.away)
        : null;

    const matchday = await this.prisma.matchday.upsert({
      where: { leagueId_season_number: { leagueId, season, number: matchdayNumber } },
      update: {},
      create: { leagueId, season, number: matchdayNumber },
    });

    const homeApiId: number | undefined = match.homeTeam?.id;
    const awayApiId: number | undefined = match.awayTeam?.id;
    if (!homeApiId || !awayApiId) return;

    const homeTeamKey = leagueApiFootballId * FOOTBALL_DATA_TEAM_ID_FACTOR + homeApiId;
    const awayTeamKey = leagueApiFootballId * FOOTBALL_DATA_TEAM_ID_FACTOR + awayApiId;

    const homeTeam = await this.prisma.footballTeam.findUnique({
      where: { apiFootballId: homeTeamKey },
    });
    const awayTeam = await this.prisma.footballTeam.findUnique({
      where: { apiFootballId: awayTeamKey },
    });

    if (!homeTeam || !awayTeam) return;

    let winnerTeamId: string | null = null;
    if (matchStatus === MatchStatus.FINISHED && homeScore !== null && awayScore !== null) {
      if (homeScore > awayScore) winnerTeamId = homeTeam.id;
      if (awayScore > homeScore) winnerTeamId = awayTeam.id;
    }

    await this.prisma.match.upsert({
      where: { apiFootballFixtureId: fixtureId },
      update: {
        matchdayId: matchday.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        kickoffTime,
        status: matchStatus,
        homeScore,
        awayScore,
        winnerTeamId,
      },
      create: {
        matchdayId: matchday.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        kickoffTime,
        status: matchStatus,
        homeScore,
        awayScore,
        winnerTeamId,
        apiFootballFixtureId: fixtureId,
      },
    });

    // Update firstKickoff of matchday if earlier than current
    if (!matchday.firstKickoff || kickoffTime < matchday.firstKickoff) {
      await this.prisma.matchday.update({
        where: { id: matchday.id },
        data: { firstKickoff: kickoffTime },
      });
    }
  }

  private async processFinishedFootballDataMatch(match: any) {
    const fixtureId: number = match.id;

    const existing = await this.prisma.match.findUnique({
      where: { apiFootballFixtureId: fixtureId },
      include: { matchday: true },
    });

    if (!existing || existing.status === MatchStatus.FINISHED) return;

    const homeScore: number = match.score?.fullTime?.home ?? 0;
    const awayScore: number = match.score?.fullTime?.away ?? 0;

    // Winner team: ya tenemos los ids correctos en el match existente.
    let winnerTeamId: string | null = null;
    if (homeScore > awayScore) winnerTeamId = existing.homeTeamId;
    if (awayScore > homeScore) winnerTeamId = existing.awayTeamId;

    await this.prisma.match.update({
      where: { id: existing.id },
      data: {
        homeScore,
        awayScore,
        winnerTeamId,
        status: MatchStatus.FINISHED,
      },
    });

    const allMatches = await this.prisma.match.findMany({
      where: { matchdayId: existing.matchdayId },
    });

    const allFinished = allMatches.every(
      (m) => m.status === MatchStatus.FINISHED || m.status === MatchStatus.CANCELLED || m.status === MatchStatus.POSTPONED,
    );
    const allDone = allMatches.every((m) => m.status === MatchStatus.FINISHED || m.status === MatchStatus.CANCELLED);

    if (allFinished) {
      await this.prisma.matchday.update({
        where: { id: existing.matchdayId },
        data: { status: allDone ? 'FINISHED' : 'ONGOING' },
      });
    }

    this.logger.log(`Match ${existing.id} → FINISHED (football-data) (${homeScore}:${awayScore})`);

    await this.pickProcessing.processMatchResult(existing.id);
  }

  private async upsertFixture(fixture: any, leagueId: string, season: number) {
    const fixtureId: number = fixture.fixture.id;
    const matchdayNumber: number = fixture.league.round
      ? parseInt((fixture.league.round as string).replace(/\D+/g, ''), 10)
      : 0;

    if (!matchdayNumber) return;

    const kickoffTime = new Date(fixture.fixture.date);
    const apiStatus: string = fixture.fixture.status?.short ?? 'NS';
    const matchStatus: MatchStatus = MATCH_STATUS_MAP[apiStatus] ?? MatchStatus.SCHEDULED;

    // Upsert matchday
    const matchday = await this.prisma.matchday.upsert({
      where: { leagueId_season_number: { leagueId, season, number: matchdayNumber } },
      update: {},
      create: { leagueId, season, number: matchdayNumber },
    });

    // Find home and away teams by apiFootballId
    const homeTeam = await this.prisma.footballTeam.findUnique({
      where: { apiFootballId: fixture.teams.home.id },
    });
    const awayTeam = await this.prisma.footballTeam.findUnique({
      where: { apiFootballId: fixture.teams.away.id },
    });

    if (!homeTeam || !awayTeam) return;

    // Upsert match
    await this.prisma.match.upsert({
      where: { apiFootballFixtureId: fixtureId },
      update: {
        kickoffTime,
        status: matchStatus,
      },
      create: {
        matchdayId: matchday.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        kickoffTime,
        status: matchStatus,
        apiFootballFixtureId: fixtureId,
      },
    });

    // Update firstKickoff of matchday if earlier than current
    if (!matchday.firstKickoff || kickoffTime < matchday.firstKickoff) {
      await this.prisma.matchday.update({
        where: { id: matchday.id },
        data: { firstKickoff: kickoffTime },
      });
    }
  }

  private async processFinishedFixture(fixture: any, leagueId: string, season: number) {
    const fixtureId: number = fixture.fixture.id;

    const existing = await this.prisma.match.findUnique({
      where: { apiFootballFixtureId: fixtureId },
      include: { matchday: true },
    });

    // First result is definitive (no re-processing)
    if (!existing || existing.status === MatchStatus.FINISHED) return;

    const homeScore: number = fixture.goals.home ?? 0;
    const awayScore: number = fixture.goals.away ?? 0;

    let winnerTeamId: string | null = null;
    if (homeScore > awayScore) {
      const homeTeam = await this.prisma.footballTeam.findUnique({
        where: { apiFootballId: fixture.teams.home.id },
      });
      winnerTeamId = homeTeam?.id ?? null;
    } else if (awayScore > homeScore) {
      const awayTeam = await this.prisma.footballTeam.findUnique({
        where: { apiFootballId: fixture.teams.away.id },
      });
      winnerTeamId = awayTeam?.id ?? null;
    }

    await this.prisma.match.update({
      where: { id: existing.id },
      data: {
        homeScore,
        awayScore,
        winnerTeamId,
        status: MatchStatus.FINISHED,
      },
    });

    // Check if all matches in matchday are done → mark matchday FINISHED
    const allMatches = await this.prisma.match.findMany({
      where: { matchdayId: existing.matchdayId },
    });
    const allFinished = allMatches.every(
      (m) => m.status === MatchStatus.FINISHED || m.status === MatchStatus.CANCELLED || m.status === MatchStatus.POSTPONED,
    );
    const allDone = allMatches.every(
      (m) => m.status === MatchStatus.FINISHED || m.status === MatchStatus.CANCELLED,
    );

    if (allFinished) {
      await this.prisma.matchday.update({
        where: { id: existing.matchdayId },
        data: { status: allDone ? 'FINISHED' : 'ONGOING' },
      });
    }

    this.logger.log(`Match ${existing.id} → FINISHED (${homeScore}:${awayScore})`);

    // Trigger pick processing for this match
    await this.pickProcessing.processMatchResult(existing.id);
  }
}
