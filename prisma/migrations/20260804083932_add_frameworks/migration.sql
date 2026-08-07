-- CreateTable
CREATE TABLE "Framework" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Program" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "frameworkId" INTEGER NOT NULL,
    CONSTRAINT "Program_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "programId" INTEGER NOT NULL,
    "reference" TEXT,
    "owner" TEXT,
    "target_quarter" TEXT NOT NULL,
    "adjusted_target_quarter" TEXT NOT NULL,
    "actual_completion_date" TEXT,
    CONSTRAINT "Project_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_code" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "assignee" TEXT,
    "priority" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "EntityChangeLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "change_type" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "remarks" TEXT,
    "created_at" TEXT NOT NULL,
    "seq" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Framework_name_key" ON "Framework"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Program_name_key" ON "Program"("name");

-- CreateIndex
CREATE INDEX "Program_frameworkId_idx" ON "Program"("frameworkId");

-- CreateIndex
CREATE INDEX "Project_programId_idx" ON "Project"("programId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "EntityChangeLog_entity_type_entity_id_idx" ON "EntityChangeLog"("entity_type", "entity_id");
