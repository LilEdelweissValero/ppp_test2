-- Enable Row Level Security on all tables.
-- No policies are created, so non-owner roles (anon, authenticated)
-- are denied all access via the Supabase Data API by default.
-- The app's Prisma connection uses the owning `postgres` role,
-- which bypasses RLS and is unaffected.

ALTER TABLE "Framework" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityChangeLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemMetadata" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
