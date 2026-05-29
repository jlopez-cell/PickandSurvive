-- CreateEnum
CREATE TYPE "PickType" AS ENUM ('WIN', 'WIN_OR_DRAW');

-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "pickType" "PickType" NOT NULL DEFAULT 'WIN';
