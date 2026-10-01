-- Add new social token notification types to the enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VETO_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHALLENGE_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BLOCK_RECEIVED';
