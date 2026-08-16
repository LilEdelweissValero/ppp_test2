import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuarterValid } from "@/lib/quarters";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    projectId,
    taskCode,
    name,
    assignee,
    priority,
    description,
    dependencies,
    notes,
    status,
    targetQuarter,
    deliverable,
    attachments,
  } = body;

  if (!projectId) {
    return NextResponse.json({ error: "Project is required" }, { status: 400 });
  }
  if (!taskCode || typeof taskCode !== "string" || !taskCode.trim()) {
    return NextResponse.json({ error: "Task code is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }
  if (!targetQuarter || !isQuarterValid(targetQuarter)) {
    return NextResponse.json({ error: "Valid target quarter is required" }, { status: 400 });
  }

  const parsedProjectId = parseInt(projectId);
  const [project, existing, maxOrder] = await Promise.all([
    prisma.project.findUnique({
      where: { id: parsedProjectId },
      select: { id: true },
    }),
    prisma.task.findFirst({
      where: {
        taskCode: taskCode.trim(),
      },
      select: { id: true },
    }),
    prisma.task.aggregate({
      _max: { sortOrder: true },
      where: { projectId: parsedProjectId },
    }),
  ]);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (existing) {
    return NextResponse.json(
      { error: "A task with this code already exists" },
      { status: 409 }
    );
  }

  const task = await prisma.task.create({
    data: {
      taskCode: taskCode.trim(),
      projectId: parsedProjectId,
      name: name.trim(),
      assignee: assignee || null,
      priority: priority || "Low",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      description: description || null,
      dependencies: dependencies || null,
      notes: notes || null,
      status,
      targetQuarter,
      adjustedTargetQuarter: targetQuarter,
      deliverable: deliverable || null,
      attachments: attachments || null,
    },
  });
  await Promise.all([
    touchLastModified(),
    logChange({
      entityType: "Task",
      entityId: task.id,
      entityName: `${task.taskCode}: ${task.name}`,
      changeType: "create",
      newValue: task.name,
    }),
  ]);
  return NextResponse.json(task, { status: 201 });
}
