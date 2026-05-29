-- Allow picks without a team (elimination by missing pick).
ALTER TABLE "Pick" ALTER COLUMN "teamId" DROP NOT NULL;

-- Quita equipos ficticios históricos en eliminaciones por no pick.
UPDATE "Pick" SET "teamId" = NULL WHERE status = 'NO_PICK_ELIMINATED';
