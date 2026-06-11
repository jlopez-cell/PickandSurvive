-- AlterTable: add edition name and winner tracking
ALTER TABLE "Edition" ADD COLUMN "name" TEXT,
                      ADD COLUMN "winnerUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_winnerUserId_fkey"
  FOREIGN KEY ("winnerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
