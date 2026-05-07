ALTER TABLE "SocialPost"
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastErrorCode" TEXT,
ADD COLUMN "lastErrorMessage" TEXT;
