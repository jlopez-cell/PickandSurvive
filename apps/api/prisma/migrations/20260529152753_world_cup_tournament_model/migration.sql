-- CreateEnum
CREATE TYPE "TournamentPhase" AS ENUM ('GROUP_STAGE', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL');

-- AlterEnum
ALTER TYPE "ChampionshipMode" ADD VALUE 'WORLD_CUP';

-- DropForeignKey
ALTER TABLE "Pick" DROP CONSTRAINT "Pick_teamId_fkey";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "tournamentPhase" "TournamentPhase",
ADD COLUMN     "wcGroup" TEXT;

-- AlterTable
ALTER TABLE "Matchday" ADD COLUMN     "tournamentPhase" "TournamentPhase",
ADD COLUMN     "wcGroupDay" INTEGER;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "eliminatedAtPhase" "TournamentPhase";

-- CreateTable
CREATE TABLE "WcGroup" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "WcGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WcGroupStanding" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "drawn" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WcGroupStanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WcGroup_leagueId_season_name_key" ON "WcGroup"("leagueId", "season", "name");

-- CreateIndex
CREATE INDEX "WcGroupStanding_groupId_points_idx" ON "WcGroupStanding"("groupId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "WcGroupStanding_groupId_teamId_key" ON "WcGroupStanding"("groupId", "teamId");

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FootballTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WcGroup" ADD CONSTRAINT "WcGroup_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "FootballLeague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WcGroupStanding" ADD CONSTRAINT "WcGroupStanding_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WcGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WcGroupStanding" ADD CONSTRAINT "WcGroupStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FootballTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
