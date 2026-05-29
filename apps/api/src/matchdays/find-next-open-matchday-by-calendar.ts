import { MatchdayStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Entre jornadas SCHEDULED u ONGOING, la “siguiente” en competiciones tipo LaLiga debe seguir el
 * calendario real (primer pitido), no el número de jornada: a veces se adelanta una jornada
 * mayor antes que otra menor aún pendiente.
 */
export async function findNextOpenMatchdayByCalendar(
  prisma: PrismaService,
  baseWhere: Prisma.MatchdayWhereInput,
): Promise<{ id: string; number: number; firstKickoff: Date | null; status: MatchdayStatus } | null> {
  const open = await prisma.matchday.findMany({
    where: {
      ...baseWhere,
      status: { in: [MatchdayStatus.SCHEDULED, MatchdayStatus.ONGOING] },
    },
    select: { id: true, number: true, firstKickoff: true, status: true },
  });

  if (open.length === 0) return null;

  const missingKickoffIds = open.filter((m) => !m.firstKickoff).map((m) => m.id);
  const minKickoffByMatchdayId = new Map<string, Date>();
  if (missingKickoffIds.length > 0) {
    const grouped = await prisma.match.groupBy({
      by: ['matchdayId'],
      where: { matchdayId: { in: missingKickoffIds } },
      _min: { kickoffTime: true },
    });
    for (const row of grouped) {
      const t = row._min.kickoffTime;
      if (t) minKickoffByMatchdayId.set(row.matchdayId, t);
    }
  }

  type Row = (typeof open)[number];
  const calendarKey = (m: Row): number => {
    const t = m.firstKickoff ?? minKickoffByMatchdayId.get(m.id) ?? null;
    return t ? t.getTime() : Number.MAX_SAFE_INTEGER;
  };

  open.sort((a, b) => {
    const ka = calendarKey(a);
    const kb = calendarKey(b);
    if (ka !== kb) return ka - kb;
    return a.number - b.number;
  });

  return open[0] ?? null;
}
