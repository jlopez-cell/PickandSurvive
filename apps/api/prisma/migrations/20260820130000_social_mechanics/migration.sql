CREATE TYPE "ChallengeStatus" AS ENUM ('ACTIVE', 'RESOLVED');
CREATE TYPE "ChallengeResult" AS ENUM ('CHALLENGER_WINS', 'CHALLENGED_WINS', 'TIE');

ALTER TABLE "Championship" ADD COLUMN "blockCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Championship" ADD COLUMN "vetoCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Championship" ADD COLUMN "challengeCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Participant" ADD COLUMN "blocksRemaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Participant" ADD COLUMN "vetosRemaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Participant" ADD COLUMN "challengesRemaining" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Block" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "blockerParticipantId" TEXT NOT NULL,
  "blockedParticipantId" TEXT NOT NULL,
  "matchdayNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Block_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Block_editionId_blockedParticipantId_matchdayNumber_key" UNIQUE ("editionId", "blockedParticipantId", "matchdayNumber"),
  CONSTRAINT "Block_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Block_blockerParticipantId_fkey" FOREIGN KEY ("blockerParticipantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Block_blockedParticipantId_fkey" FOREIGN KEY ("blockedParticipantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Veto" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "vetoerParticipantId" TEXT NOT NULL,
  "vetoedParticipantId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "matchdayNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Veto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Veto_editionId_vetoedParticipantId_teamId_matchdayNumber_key" UNIQUE ("editionId", "vetoedParticipantId", "teamId", "matchdayNumber"),
  CONSTRAINT "Veto_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Veto_vetoerParticipantId_fkey" FOREIGN KEY ("vetoerParticipantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Veto_vetoedParticipantId_fkey" FOREIGN KEY ("vetoedParticipantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Veto_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FootballTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Challenge" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "challengerParticipantId" TEXT NOT NULL,
  "challengedParticipantId" TEXT NOT NULL,
  "matchdayNumber" INTEGER NOT NULL,
  "status" "ChallengeStatus" NOT NULL DEFAULT 'ACTIVE',
  "result" "ChallengeResult",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Challenge_editionId_challengerParticipantId_matchdayNumber_key" UNIQUE ("editionId", "challengerParticipantId", "matchdayNumber"),
  CONSTRAINT "Challenge_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Challenge_challengerParticipantId_fkey" FOREIGN KEY ("challengerParticipantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Challenge_challengedParticipantId_fkey" FOREIGN KEY ("challengedParticipantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
