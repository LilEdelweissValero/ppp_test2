-- SuchTask was created outside the migration history (likely via `prisma db push`).
-- Everything below is idempotent so it is safe on databases that already have the table.

-- CreateTable
CREATE TABLE IF NOT EXISTS "SuchTask" (
    "id" SERIAL NOT NULL,
    "such_task_code" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "phase_id" INTEGER,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "total_scheduled" INTEGER NOT NULL DEFAULT 0,
    "sv" INTEGER NOT NULL DEFAULT 0,
    "snv" INTEGER NOT NULL DEFAULT 0,
    "nsv" INTEGER NOT NULL DEFAULT 0,
    "due_quarter" TEXT NOT NULL,
    "last_updated_date" TEXT,
    "abandoned" BOOLEAN NOT NULL DEFAULT false,
    "abandoned_at" TEXT,
    "abandoned_reason" TEXT,
    "abandoned_remarks" TEXT,

    CONSTRAINT "SuchTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SuchTask_projectId_idx" ON "SuchTask"("projectId");
CREATE INDEX IF NOT EXISTS "SuchTask_phaseId_idx" ON "SuchTask"("phase_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SuchTask_projectId_fkey') THEN
        ALTER TABLE "SuchTask" ADD CONSTRAINT "SuchTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SuchTask_phase_id_fkey') THEN
        ALTER TABLE "SuchTask" ADD CONSTRAINT "SuchTask_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Enable RLS on the tables added after 20260826000000_enable_rls.
-- No policies are created, so anon/authenticated are denied via the Supabase Data API.
-- The app's Prisma connection uses the owning `postgres` role, which bypasses RLS.
ALTER TABLE "Phase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuchTask" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
