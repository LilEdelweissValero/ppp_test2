import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFieldsV2 } from "@/lib/audit-log";
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
    abandoned,
    abandonedReason,
    abandonedRemarks,
    phaseId,
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

  const updateData: Record<string, string | boolean | number | null | { url: string; title: string | null }[]> = {};
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
  if (abandoned !== undefined && typeof abandoned === "boolean") {
    const abandonedAt = abandoned ? new Date().toISOString() : null;
    updateData.abandoned = abandoned;
    updateData.abandonedAt = abandonedAt;
    updateData.abandonedReason = abandoned ? abandonedReason ?? null : null;
    updateData.abandonedRemarks = abandoned ? abandonedRemarks ?? null : null;
  }
  if (phaseId !== undefined) updateData.phaseId = phaseId ? parseInt(phaseId) : null;

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
        const oldDeps = sibling.dependencies;
        const newDeps = sibling.dependencies.replaceAll(oldCode, newCode);
        await prisma.task.update({
          where: { id: sibling.id },
          data: { dependencies: newDeps },
        });
        await logChange({
          entityType: "Task",
          entityId: sibling.id,
          entityName: `${sibling.taskCode}: ${sibling.name}`,
          changeType: "update",
          details: diffFieldsV2(
            { dependencies: oldDeps },
            { dependencies: newDeps },
            ["dependencies"]
          ),
        });
      }
    }
  }

  const details = diffFieldsV2(
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

  if (abandoned !== undefined && typeof abandoned === "boolean") {
    await logChange({
      entityType: "Task",
      entityId: task.id,
      entityName: `${task.taskCode}: ${task.name}`,
      changeType: abandoned ? "abandon" : "unabandon",
      details: JSON.stringify({ reason: abandonedReason, remarks: abandonedRemarks }),
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
        details: diffFieldsV2(
          { actualCompletionDate: currentVal },
          { actualCompletionDate: today },
          ["actualCompletionDate"]
        ),
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
        details: diffFieldsV2(
          { actualCompletionDate: currentVal },
          { actualCompletionDate: null },
          ["actualCompletionDate"]
        ),
      });
    }
  }

  await touchLastModified();
  return NextResponse.json(task);
}
