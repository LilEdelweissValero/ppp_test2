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
  const { newQuarter } = body;

  if (!newQuarter || !isQuarterValid(newQuarter)) {
    return NextResponse.json({ error: "Valid quarter is required" }, { status: 400 });
  }

  const existingTask = await prisma.suchTask.findUnique({ where: { id: parseInt(id) } });
  if (!existingTask) {
    return NextResponse.json({ error: "SUCH task not found" }, { status: 404 });
  }

  const oldQuarter = existingTask.dueQuarter;
  if (oldQuarter === newQuarter) {
    return NextResponse.json({ error: "Quarter is unchanged" }, { status: 400 });
  }

  const suchTask = await prisma.suchTask.update({
    where: { id: parseInt(id) },
    data: { dueQuarter: newQuarter },
  });

  await Promise.all([
    touchLastModified(),
    logChange({
      entityType: "SuchTask",
      entityId: suchTask.id,
      entityName: `${suchTask.suchTaskCode}: ${suchTask.name}`,
      changeType: "quarter_change",
      oldValue: oldQuarter,
      newValue: newQuarter,
    }),
  ]);

  return NextResponse.json(suchTask);
}
