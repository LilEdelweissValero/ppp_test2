-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Framework" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Framework" ("color", "id", "name") SELECT "color", "id", "name" FROM "Framework";
DROP TABLE "Framework";
ALTER TABLE "new_Framework" RENAME TO "Framework";
CREATE UNIQUE INDEX "Framework_name_key" ON "Framework"("name");
CREATE TABLE "new_Program" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "frameworkId" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Program_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Program" ("frameworkId", "id", "name") SELECT "frameworkId", "id", "name" FROM "Program";
DROP TABLE "Program";
ALTER TABLE "new_Program" RENAME TO "Program";
CREATE UNIQUE INDEX "Program_name_key" ON "Program"("name");
CREATE INDEX "Program_frameworkId_idx" ON "Program"("frameworkId");
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "programId" INTEGER NOT NULL,
    "reference" TEXT,
    "owner" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "target_quarter" TEXT NOT NULL,
    "adjusted_target_quarter" TEXT NOT NULL,
    "actual_completion_date" TEXT,
    CONSTRAINT "Project_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("actual_completion_date", "adjusted_target_quarter", "id", "name", "owner", "programId", "reference", "target_quarter") SELECT "actual_completion_date", "adjusted_target_quarter", "id", "name", "owner", "programId", "reference", "target_quarter" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_programId_idx" ON "Project"("programId");
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_code" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "assignee" TEXT,
    "priority" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "dependencies" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "target_quarter" TEXT NOT NULL,
    "adjusted_target_quarter" TEXT NOT NULL,
    "deliverable" TEXT,
    "attachment_url" TEXT,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("adjusted_target_quarter", "assignee", "attachment_url", "deliverable", "dependencies", "description", "id", "name", "notes", "priority", "projectId", "status", "target_quarter", "task_code") SELECT "adjusted_target_quarter", "assignee", "attachment_url", "deliverable", "dependencies", "description", "id", "name", "notes", "priority", "projectId", "status", "target_quarter", "task_code" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
