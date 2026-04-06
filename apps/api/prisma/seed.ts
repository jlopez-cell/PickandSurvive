import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const FOOTBALL_LEAGUES = [
  {
    name: 'LaLiga',
    country: 'Spain',
    // football-data.org: Primera Division
    apiFootballId: 2014,
    totalMatchdaysPerSeason: 38,
    currentSeason: 2025,
  },
  {
    name: 'LaLiga Hypermotion',
    country: 'Spain',
    // football-data.org: Segunda División (código SD)
    apiFootballId: 2077,
    totalMatchdaysPerSeason: 42,
    currentSeason: 2025,
  },
  {
    name: 'Premier League',
    country: 'England',
    // football-data.org: Premier League
    apiFootballId: 2021,
    totalMatchdaysPerSeason: 38,
    currentSeason: 2025,
  },
  {
    name: 'Serie A',
    country: 'Italy',
    // football-data.org: Serie A
    apiFootballId: 2019,
    totalMatchdaysPerSeason: 38,
    currentSeason: 2025,
  },
  {
    // League phase: 8 matchdays. Playoff rounds managed separately by admin.
    name: 'UEFA Champions League',
    country: 'Europe',
    // football-data.org: UEFA Champions League
    apiFootballId: 2001,
    totalMatchdaysPerSeason: 8,
    currentSeason: 2025,
  },
];

const SUPERADMIN = {
  email: 'admin@pickandsurvive.com',
  alias: 'superadmin',
  password: 'Admin1234!',
};

async function main() {
  // ─── Ligas ────────────────────────────────────────────────────────────────
  console.log('Seeding football leagues...');

  for (const league of FOOTBALL_LEAGUES) {
    const result = await prisma.footballLeague.upsert({
      where: { apiFootballId: league.apiFootballId },
      update: {
        name: league.name,
        country: league.country,
        totalMatchdaysPerSeason: league.totalMatchdaysPerSeason,
        currentSeason: league.currentSeason,
      },
      create: league,
    });
    console.log(`  ✓ ${result.name} (id: ${result.apiFootballId})`);
  }

  // ─── SUPERADMIN ───────────────────────────────────────────────────────────
  console.log('\nSeeding superadmin user...');

  const passwordHash = await bcrypt.hash(SUPERADMIN.password, 10);

  const admin = await prisma.user.upsert({
    where: { email: SUPERADMIN.email },
    update: { role: UserRole.SUPERADMIN, emailVerified: true },
    create: {
      email: SUPERADMIN.email,
      alias: SUPERADMIN.alias,
      passwordHash,
      emailVerified: true,
      role: UserRole.SUPERADMIN,
    },
  });

  console.log(`  ✓ ${admin.email} (role: ${admin.role})`);

  console.log('\nSeed completed successfully.');
  console.log('\n  Credenciales admin:');
  console.log(`  Email:    ${SUPERADMIN.email}`);
  console.log(`  Password: ${SUPERADMIN.password}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
