import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id: parseInt(id) },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
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
  const { name, programId, reference, owner, targetQuarter, adjustedTargetQuarter, actualCompletionDate } = body;

  const updateData: Record<string, string | number | null> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (reference !== undefined) updateData.reference = reference || null;
  if (owner !== undefined) updateData.owner = owner || null;
  if (targetQuarter !== undefined) updateData.targetQuarter = targetQuarter;
  if (adjustedTargetQuarter !== undefined) updateData.adjustedTargetQuarter = adjustedTargetQuarter;
  if (actualCompletionDate !== undefined) updateData.actualCompletionDate = actualCompletionDate || null;
  if (programId !== undefined) updateData.programId = parseInt(programId);

  const project = await prisma.project.update({
    where: { id: parseInt(id) },
    data: updateData,
  });
  await touchLastModified();
  return NextResponse.json(project);
}
