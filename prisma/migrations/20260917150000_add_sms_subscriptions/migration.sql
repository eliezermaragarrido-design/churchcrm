CREATE TABLE "SmsSubscription" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "SmsSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SmsSubscription_churchId_phoneNumber_revokedAt_idx" ON "SmsSubscription"("churchId", "phoneNumber", "revokedAt");
ALTER TABLE "SmsSubscription" ADD CONSTRAINT "SmsSubscription_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmsSubscription" ENABLE ROW LEVEL SECURITY;
