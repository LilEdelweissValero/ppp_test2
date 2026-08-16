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
    return NextResponse.json({ error: "Valid quarter is required" }, { status: 400 });
  }

  const existing = await prisma.specialTask.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return NextResponse.json({ error: "Special task not found" }, { status: 404 });
  }

  const oldQuarter = existing.dueQuarter;
  if (oldQuarter === newQuarter) {
    return NextResponse.json({ error: "Quarter is the same" }, { status: 400 });
  }

  const specialTask = await prisma.specialTask.update({
    where: { id: parseInt(id) },
    data: { dueQuarter: newQuarter },
  });

  await Promise.all([
    touchLastModified(),
    logChange({
      entityType: "SpecialTask",
      entityId: specialTask.id,
      entityName: `${specialTask.specialTaskCode}: ${specialTask.name}`,
      changeType: "quarter_change",
      oldValue: oldQuarter,
      newValue: newQuarter,
      remarks: remarks || null,
    }),
  ]);

  return NextResponse.json(specialTask);
}
