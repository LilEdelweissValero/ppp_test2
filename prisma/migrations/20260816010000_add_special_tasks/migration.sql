-- CreateTable
CREATE TABLE "SpecialTask" (
    "id" SERIAL NOT NULL,
    "special_task_code" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "nys" INTEGER NOT NULL DEFAULT 0,
    "plan" INTEGER NOT NULL DEFAULT 0,
    "part" INTEGER NOT NULL DEFAULT 0,
    "mostly" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "due_quarter" TEXT NOT NULL,
    "last_updated_date" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SpecialTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialTask_projectId_idx" ON "SpecialTask"("projectId");

-- AddForeignKey
ALTER TABLE "SpecialTask" ADD CONSTRAINT "SpecialTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
