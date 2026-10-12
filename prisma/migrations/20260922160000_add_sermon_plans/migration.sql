CREATE TABLE "SermonPlan" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "scriptureReference" TEXT NOT NULL,
    "series" TEXT,
    "theme" TEXT,
    "mainIdea" TEXT,
    "serviceTime" TEXT,
    "location" TEXT,
    "language" TEXT NOT NULL DEFAULT 'English',
    "pastorNotes" TEXT,
    "generatedJson" TEXT,
    "approvedJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SermonPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SermonPlan_churchId_serviceDate_idx" ON "SermonPlan"("churchId", "serviceDate");
ALTER TABLE "SermonPlan" ADD CONSTRAINT "SermonPlan_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SermonPlan" ENABLE ROW LEVEL SECURITY;
