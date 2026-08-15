import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFields } from "@/lib/audit-log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    taskCode,
    name,
    assignee,
    priority,
    description,
    dependencies,
    notes,
    status,
    targetQuarter,
    adjustedTargetQuarter,
    deliverable,
    attachmentUrl,
  } = body;

  const existingTask = await prisma.task.findUnique({ where: { id: parseInt(id) } });
  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updateData: Record<string, string | null> = {};
  if (taskCode !== undefined) updateData.taskCode = taskCode.trim();
  if (name !== undefined) updateData.name = name.trim();
  if (assignee !== undefined) updateData.assignee = assignee || null;
  if (priority !== undefined) updateData.priority = priority;
  if (description !== undefined) updateData.description = description || null;
  if (dependencies !== undefined) updateData.dependencies = dependencies || null;
  if (notes !== undefined) updateData.notes = notes || null;
  if (status !== undefined) updateData.status = status;
  if (targetQuarter !== undefined) updateData.targetQuarter = targetQuarter;
  if (adjustedTargetQuarter !== undefined) updateData.adjustedTargetQuarter = adjustedTargetQuarter;
  if (deliverable !== undefined) updateData.deliverable = deliverable || null;
  if (attachmentUrl !== undefined) updateData.attachmentUrl = attachmentUrl || null;

  const task = await prisma.task.update({
    where: { id: parseInt(id) },
    data: updateData,
  });

  const details = diffFields(
    existingTask as Record<string, unknown>,
    updateData,
    ["taskCode", "name", "assignee", "priority", "status", "description", "dependencies", "notes", "deliverable", "attachmentUrl", "targetQuarter", "adjustedTargetQuarter"]
  );
  if (details) {
    await logChange({
      entityType: "Task",
      entityId: task.id,
      entityName: `${task.taskCode}: ${task.name}`,
      changeType: "update",
      details,
    });
  }

  // Auto-set project completion date when all tasks are "Complete or Verified"
  const allSiblings = await prisma.task.findMany({
    where: { projectId: existingTask.projectId },
  });
  const allComplete = allSiblings.every(
    (t) => t.status === "Complete or Verified"
  );
  const today = new Date().toISOString().slice(0, 10);

  const project = await prisma.project.findUnique({
    where: { id: existingTask.projectId },
  });
  if (project) {
    const shouldSet = allComplete;
    const currentVal = project.actualCompletionDate;
    if (shouldSet && currentVal !== today) {
      await prisma.project.update({
        where: { id: existingTask.projectId },
        data: { actualCompletionDate: today },
      });
      await logChange({
        entityType: "Project",
        entityId: existingTask.projectId,
        entityName: project.name,
        changeType: "update",
        details: `Auto-set actual completion date to ${today} (all tasks completed)`,
      });
    } else if (!shouldSet && currentVal !== null) {
      await prisma.project.update({
        where: { id: existingTask.projectId },
        data: { actualCompletionDate: null },
      });
      await logChange({
        entityType: "Project",
        entityId: existingTask.projectId,
        entityName: project.name,
        changeType: "update",
        details: "Auto-cleared actual completion date (not all tasks completed)",
      });
    }
  }

  await touchLastModified();
  return NextResponse.json(task);
}
