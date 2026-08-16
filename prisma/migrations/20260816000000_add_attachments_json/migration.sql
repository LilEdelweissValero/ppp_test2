-- AlterTable: Add attachments column
ALTER TABLE "Task" ADD COLUMN "attachments" JSONB;

-- Migrate existing data: wrap each URL in the array format
UPDATE "Task"
SET "attachments" = ('[{"url": "' || "attachment_url" || '", "title": null}]')::jsonb
WHERE "attachment_url" IS NOT NULL AND "attachment_url" != '';

-- Drop old column
ALTER TABLE "Task" DROP COLUMN "attachment_url";
