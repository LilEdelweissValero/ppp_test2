import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuarterValid } from "@/lib/quarters";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    projectId,
    suchTaskCode,
    name,
    dueQuarter,
    phaseId,
  } = body;

  if (!projectId) {
    return NextResponse.json({ error: "Project is required" }, { status: 400 });
  }
  if (!suchTaskCode || typeof suchTaskCode !== "string" || !suchTaskCode.trim()) {
    return NextResponse.json({ error: "SUCH task code is required" }, { status: 400 });
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
    prisma.suchTask.findFirst({
      where: { suchTaskCode: suchTaskCode.trim() },
      select: { id: true },
    }),
    prisma.suchTask.aggregate({
      _max: { sortOrder: true },
      where: { projectId: parsedProjectId },
    }),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (existing) {
    return NextResponse.json(
      { error: "A SUCH task with this code already exists" },
      { status: 409 }
    );
  }

  const suchTask = await prisma.suchTask.create({
    data: {
      suchTaskCode: suchTaskCode.trim(),
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
      entityType: "SuchTask",
      entityId: suchTask.id,
      entityName: `${suchTask.suchTaskCode}: ${suchTask.name}`,
      changeType: "create",
      newValue: suchTask.name,
    }),
  ]);

  return NextResponse.json(suchTask, { status: 201 });
}
