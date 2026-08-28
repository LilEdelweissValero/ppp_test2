-- AlterTable: Add sort_order column to Framework
ALTER TABLE "Framework" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add sort_order column to Program
ALTER TABLE "Program" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add sort_order column to Project
ALTER TABLE "Project" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add sort_order column to Task
ALTER TABLE "Task" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
