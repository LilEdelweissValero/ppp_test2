import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFields } from "@/lib/audit-log";
import { getSettings } from "@/lib/computation-settings-server";

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
    attachments,
    archived,
  } = body;

  const existingTask = await prisma.task.findUnique({ where: { id: parseInt(id) } });
  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (taskCode !== undefined && taskCode.trim() !== existingTask.taskCode) {
    const newCode = taskCode.trim();
    if (!newCode) {
      return NextResponse.json({ error: "Task code cannot be empty" }, { status: 400 });
    }
    const duplicate = await prisma.task.findFirst({
      where: { taskCode: newCode, id: { not: parseInt(id) } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A task with this code already exists" },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, string | boolean | null | { url: string; title: string | null }[]> = {};
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
  if (attachments !== undefined) {
    updateData.attachments = Array.isArray(attachments) && attachments.length > 0
      ? attachments
      : null;
  }
  if (archived !== undefined && typeof archived === "boolean") updateData.archived = archived;

  const task = await prisma.task.update({
    where: { id: parseInt(id) },
    data: updateData,
  });

  if (updateData.taskCode && updateData.taskCode !== existingTask.taskCode) {
    const oldCode = existingTask.taskCode;
    const newCode = String(updateData.taskCode);
    const siblings = await prisma.task.findMany({
      where: { projectId: existingTask.projectId, id: { not: task.id } },
    });
    for (const sibling of siblings) {
      if (sibling.dependencies && sibling.dependencies.includes(oldCode)) {
        await prisma.task.update({
          where: { id: sibling.id },
          data: { dependencies: sibling.dependencies.replaceAll(oldCode, newCode) },
        });
      }
    }
  }

  const details = diffFields(
    existingTask as Record<string, unknown>,
    updateData,
    ["taskCode", "name", "assignee", "priority", "status", "description", "dependencies", "notes", "deliverable", "attachments", "targetQuarter", "adjustedTargetQuarter"]
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
  const settings = await getSettings();
  const doneStatusName = settings.statuses[4].name;
  const allSiblings = await prisma.task.findMany({
    where: { projectId: existingTask.projectId },
  });
  const allComplete = allSiblings.every(
    (t) => t.status === doneStatusName
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
