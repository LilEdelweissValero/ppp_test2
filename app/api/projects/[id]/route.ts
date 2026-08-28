import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFieldsV2 } from "@/lib/audit-log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id: parseInt(id) },
    include: {
      program: { select: { id: true, name: true } },
      phases: {
        where: { archived: false },
        orderBy: { sortOrder: "asc" },
      },
      tasks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, programId, reference, owner, targetQuarter, adjustedTargetQuarter, actualCompletionDate, phasesTableName, abandoned, abandonedReason, abandonedRemarks } = body;

  const oldProject = await prisma.project.findUnique({ where: { id: parseInt(id) } });

  if (abandoned !== undefined && typeof abandoned === "boolean" && oldProject) {
    const abandonedAt = abandoned ? new Date().toISOString() : null;
    const tasks = await prisma.task.findMany({
      where: { projectId: parseInt(id) },
      select: { id: true, taskCode: true, name: true },
    });
    const specialTasks = await prisma.specialTask.findMany({
      where: { projectId: parseInt(id) },
      select: { id: true, specialTaskCode: true, name: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: parseInt(id) },
        data: { abandoned, abandonedAt, abandonedReason: abandoned ? abandonedReason ?? null : null, abandonedRemarks: abandoned ? abandonedRemarks ?? null : null },
      });
      await tx.task.updateMany({
        where: { projectId: parseInt(id) },
        data: { abandoned, abandonedAt, abandonedReason: abandoned ? abandonedReason ?? null : null, abandonedRemarks: abandoned ? abandonedRemarks ?? null : null },
      });
      await tx.specialTask.updateMany({
        where: { projectId: parseInt(id) },
        data: { abandoned, abandonedAt, abandonedReason: abandoned ? abandonedReason ?? null : null, abandonedRemarks: abandoned ? abandonedRemarks ?? null : null },
      });
    });

    // Log per-task cascade entries
    for (const t of tasks) {
      await logChange({
        entityType: "Task",
        entityId: t.id,
        entityName: `${t.taskCode}: ${t.name}`,
        changeType: abandoned ? "abandon" : "unabandon",
        details: `Project ${abandoned ? "abandoned" : "unabandoned"}: cascade`,
      });
    }
    for (const st of specialTasks) {
      await logChange({
        entityType: "SpecialTask",
        entityId: st.id,
        entityName: `${st.specialTaskCode}: ${st.name}`,
        changeType: abandoned ? "abandon" : "unabandon",
        details: `Project ${abandoned ? "abandoned" : "unabandoned"}: cascade`,
      });
    }

    // Log the project-level entry
    const project = await prisma.project.findUnique({ where: { id: parseInt(id) } });
    await logChange({
      entityType: "Project",
      entityId: parseInt(id),
      entityName: project?.name || "",
      changeType: abandoned ? "abandon" : "unabandon",
      details: JSON.stringify({ reason: abandonedReason, remarks: abandonedRemarks }),
    });
    await touchLastModified();
    return NextResponse.json(project);
  }

  const updateData: Record<string, string | number | null> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (reference !== undefined) updateData.reference = reference || null;
  if (owner !== undefined) updateData.owner = owner || null;
  if (targetQuarter !== undefined) updateData.targetQuarter = targetQuarter;
  if (adjustedTargetQuarter !== undefined) updateData.adjustedTargetQuarter = adjustedTargetQuarter;
  if (actualCompletionDate !== undefined) updateData.actualCompletionDate = actualCompletionDate || null;
  if (phasesTableName !== undefined) updateData.phasesTableName = phasesTableName || null;
  if (programId !== undefined) updateData.programId = parseInt(programId);

  const project = await prisma.project.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: { program: { select: { id: true, name: true } } },
  });
  if (oldProject) {
    const details = diffFieldsV2(
      oldProject as Record<string, unknown>,
      updateData,
      ["name", "reference", "owner", "targetQuarter", "adjustedTargetQuarter", "actualCompletionDate", "phasesTableName", "programId"]
    );
    if (details) {
      await logChange({
        entityType: "Project",
        entityId: project.id,
        entityName: project.name,
        changeType: "update",
        details,
      });
      await touchLastModified();
    }
  }
  return NextResponse.json(project);
}
