import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuarterValid } from "@/lib/quarters";
import { touchLastModified } from "@/lib/system-metadata";

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

  const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.adjustedTargetQuarter === newQuarter) {
    return NextResponse.json({ error: "New quarter is the same as the current adjusted quarter" }, { status: 400 });
  }

  const lastLog = await prisma.entityChangeLog.findFirst({
    where: { entityType: "Task", entityId: parseInt(id) },
    orderBy: { seq: "desc" },
  });
  const nextSeq = lastLog ? lastLog.seq + 1 : 1;

  await prisma.$transaction([
    prisma.entityChangeLog.create({
      data: {
        entityType: "Task",
        entityId: parseInt(id),
        changeType: "quarter",
        oldValue: task.adjustedTargetQuarter,
        newValue: newQuarter,
        remarks: remarks || null,
        createdAt: new Date().toISOString(),
        seq: nextSeq,
      },
    }),
    prisma.task.update({
      where: { id: parseInt(id) },
      data: { adjustedTargetQuarter: newQuarter },
    }),
  ]);

  await touchLastModified();
  return NextResponse.json({ ok: true });
}
