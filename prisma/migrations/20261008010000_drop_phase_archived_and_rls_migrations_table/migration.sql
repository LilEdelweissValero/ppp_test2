-- Archiving was removed from the app; schema.prisma no longer has Phase.archived.
-- IF EXISTS keeps this a no-op on databases that never had the column.
ALTER TABLE "Phase" DROP COLUMN IF EXISTS "archived";

-- Prisma's own bookkeeping table lives in `public` and is exposed by the Data API.
-- The owning `postgres` role (used by Prisma) bypasses RLS, so migrations are unaffected.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
