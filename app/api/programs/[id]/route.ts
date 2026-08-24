import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFields } from "@/lib/audit-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, frameworkId, archived } = body;

  const oldProgram = await prisma.program.findUnique({ where: { id: parseInt(id) } });

  if (archived !== undefined && typeof archived === "boolean" && oldProgram) {
    await prisma.$transaction(async (tx) => {
      await tx.program.update({
        where: { id: parseInt(id) },
        data: { archived },
      });
      const projects = await tx.project.findMany({
        where: { programId: parseInt(id) },
        select: { id: true },
      });
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length > 0) {
        await tx.project.updateMany({
          where: { id: { in: projectIds } },
          data: { archived },
        });
        await tx.task.updateMany({
          where: { projectId: { in: projectIds } },
          data: { archived },
        });
      }
    });
    const program = await prisma.program.findUnique({ where: { id: parseInt(id) } });
    await logChange({
      entityType: "Program",
      entityId: parseInt(id),
      entityName: program?.name || "",
      changeType: archived ? "archive" : "unarchive",
      details: archived ? "Archived program and all child items" : "Unarchived program and all child items",
    });
    await touchLastModified();
    return NextResponse.json(program);
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const existing = await prisma.program.findFirst({
    where: { name: name.trim(), NOT: { id: parseInt(id) } },
  });
  if (existing) {
    return NextResponse.json({ error: "Program name already exists" }, { status: 409 });
  }
  const updateData: Record<string, string | number> = { name: name.trim() };
  if (frameworkId) {
    updateData.frameworkId = parseInt(frameworkId);
  }
  const program = await prisma.program.update({
    where: { id: parseInt(id) },
    data: updateData,
  });
  if (oldProgram) {
    const details = diffFields(oldProgram as Record<string, unknown>, { name: name.trim(), frameworkId: updateData.frameworkId }, ["name", "frameworkId"]);
    if (details) {
      await logChange({
        entityType: "Program",
        entityId: program.id,
        entityName: program.name,
        changeType: "update",
        details,
      });
      await touchLastModified();
    }
  }
  return NextResponse.json(program);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectCount = await prisma.project.count({
    where: { programId: parseInt(id) },
  });
  if (projectCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete program with attached projects" },
      { status: 400 }
    );
  }
  const program = await prisma.program.findUnique({ where: { id: parseInt(id) } });
  await prisma.program.delete({ where: { id: parseInt(id) } });
  if (program) {
    await logChange({
      entityType: "Program",
      entityId: program.id,
      entityName: program.name,
      changeType: "delete",
      oldValue: program.name,
    });
    await touchLastModified();
  }
  return NextResponse.json({ ok: true });
}
