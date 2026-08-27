import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuarterValid } from "@/lib/quarters";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    projectId,
    specialTaskCode,
    name,
    dueQuarter,
    phaseId,
  } = body;

  if (!projectId) {
    return NextResponse.json({ error: "Project is required" }, { status: 400 });
  }
  if (!specialTaskCode || typeof specialTaskCode !== "string" || !specialTaskCode.trim()) {
    return NextResponse.json({ error: "Special task code is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!dueQuarter || !isQuarterValid(dueQuarter)) {
    return NextResponse.json({ error: "Valid due quarter is required" }, { status: 400 });
  }

  const parsedProjectId = parseInt(projectId);
  const [project, existing, maxOrder] = await Promise.all([
    prisma.project.findUnique({
      where: { id: parsedProjectId },
      select: { id: true },
    }),
    prisma.specialTask.findFirst({
      where: { specialTaskCode: specialTaskCode.trim() },
      select: { id: true },
    }),
    prisma.specialTask.aggregate({
      _max: { sortOrder: true },
      where: { projectId: parsedProjectId },
    }),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (existing) {
    return NextResponse.json(
      { error: "A special task with this code already exists" },
      { status: 409 }
    );
  }

  const specialTask = await prisma.specialTask.create({
    data: {
      specialTaskCode: specialTaskCode.trim(),
      projectId: parsedProjectId,
      phaseId: phaseId ? parseInt(phaseId) : null,
      name: name.trim(),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      dueQuarter,
    },
  });

  await Promise.all([
    touchLastModified(),
    logChange({
      entityType: "SpecialTask",
      entityId: specialTask.id,
      entityName: `${specialTask.specialTaskCode}: ${specialTask.name}`,
      changeType: "create",
      newValue: specialTask.name,
    }),
  ]);

  return NextResponse.json(specialTask, { status: 201 });
}
