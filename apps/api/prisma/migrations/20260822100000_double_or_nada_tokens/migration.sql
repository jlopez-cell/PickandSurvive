-- AlterTable Championship: add doubleOrNadaCount token counter
ALTER TABLE "Championship" ADD COLUMN "doubleOrNadaCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Participant: add doubleOrNadaRemaining per-player counter
ALTER TABLE "Participant" ADD COLUMN "doubleOrNadaRemaining" INTEGER NOT NULL DEFAULT 0;
