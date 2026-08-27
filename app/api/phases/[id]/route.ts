import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFieldsV2 } from "@/lib/audit-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, weight } = body;

  const oldPhase = await prisma.phase.findUnique({
    where: { id: parseInt(id) },
  });
  if (!oldPhase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  const updateData: Record<string, string | number> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (weight !== undefined) updateData.weight = weight;

  const phase = await prisma.phase.update({
    where: { id: parseInt(id) },
    data: updateData,
  });

  const details = diffFieldsV2(
    oldPhase as Record<string, unknown>,
    updateData,
    ["name", "weight"]
  );
  if (details) {
    await logChange({
      entityType: "Phase",
      entityId: phase.id,
      entityName: phase.name,
      changeType: "update",
      details,
    });
    await touchLastModified();
  }

  return NextResponse.json(phase);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const phase = await prisma.phase.findUnique({
    where: { id: parseInt(id) },
  });
  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  // Set phaseId to null on associated tasks
  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { phaseId: parseInt(id) },
      data: { phaseId: null },
    });
    await tx.specialTask.updateMany({
      where: { phaseId: parseInt(id) },
      data: { phaseId: null },
    });
    await tx.phase.delete({ where: { id: parseInt(id) } });
  });

  await logChange({
    entityType: "Phase",
    entityId: phase.id,
    entityName: phase.name,
    changeType: "delete",
  });
  await touchLastModified();

  return NextResponse.json({ ok: true });
}
