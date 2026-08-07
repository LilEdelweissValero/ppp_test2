import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuarterValid } from "@/lib/quarters";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, programId, reference, owner, targetQuarter, actualCompletionDate } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!programId) {
    return NextResponse.json({ error: "Program is required" }, { status: 400 });
  }
  if (!targetQuarter || !isQuarterValid(targetQuarter)) {
    return NextResponse.json({ error: "Valid target quarter is required (Q# YYYY)" }, { status: 400 });
  }

  const program = await prisma.program.findUnique({ where: { id: parseInt(programId) } });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const maxOrder = await prisma.project.aggregate({
    _max: { sortOrder: true },
    where: { programId: parseInt(programId) },
  });
  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      programId: parseInt(programId),
      reference: reference || null,
      owner: owner || null,
      targetQuarter,
      adjustedTargetQuarter: targetQuarter,
      actualCompletionDate: actualCompletionDate || null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  await touchLastModified();
  await logChange({
    entityType: "Project",
    entityId: project.id,
    entityName: project.name,
    changeType: "create",
    newValue: project.name,
  });
  return NextResponse.json(project, { status: 201 });
}
