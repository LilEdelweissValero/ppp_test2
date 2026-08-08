import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuarterValid } from "@/lib/quarters";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { newQuarter, remarks } = body;

  if (!newQuarter || !isQuarterValid(newQuarter)) {
    return NextResponse.json({ error: "Valid new quarter is required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: parseInt(id) } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.adjustedTargetQuarter === newQuarter) {
    return NextResponse.json({ error: "New quarter is the same as the current adjusted quarter" }, { status: 400 });
  }

  await prisma.project.update({
    where: { id: parseInt(id) },
    data: { adjustedTargetQuarter: newQuarter },
  });

  await logChange({
    entityType: "Project",
    entityId: parseInt(id),
    entityName: project.name,
    changeType: "quarter",
    oldValue: project.adjustedTargetQuarter,
    newValue: newQuarter,
    remarks: remarks || null,
  });

  await touchLastModified();
  return NextResponse.json({ ok: true });
}
