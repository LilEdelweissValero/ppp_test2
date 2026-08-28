-- AlterTable: Add abandoned fields to Program
ALTER TABLE "Program" ADD COLUMN "abandoned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Program" ADD COLUMN "abandoned_at" TEXT;
ALTER TABLE "Program" ADD COLUMN "abandoned_reason" TEXT;
ALTER TABLE "Program" ADD COLUMN "abandoned_remarks" TEXT;

-- AlterTable: Add abandoned fields to Project
ALTER TABLE "Project" ADD COLUMN "abandoned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "abandoned_at" TEXT;
ALTER TABLE "Project" ADD COLUMN "abandoned_reason" TEXT;
ALTER TABLE "Project" ADD COLUMN "abandoned_remarks" TEXT;

-- AlterTable: Add abandoned fields to Task
ALTER TABLE "Task" ADD COLUMN "abandoned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "abandoned_at" TEXT;
ALTER TABLE "Task" ADD COLUMN "abandoned_reason" TEXT;
ALTER TABLE "Task" ADD COLUMN "abandoned_remarks" TEXT;

-- AlterTable: Add abandoned fields to SpecialTask
ALTER TABLE "SpecialTask" ADD COLUMN "abandoned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SpecialTask" ADD COLUMN "abandoned_at" TEXT;
ALTER TABLE "SpecialTask" ADD COLUMN "abandoned_reason" TEXT;
ALTER TABLE "SpecialTask" ADD COLUMN "abandoned_remarks" TEXT;
