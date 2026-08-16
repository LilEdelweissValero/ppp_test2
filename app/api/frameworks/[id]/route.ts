import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFields } from "@/lib/audit-log";

const PRESET_COLORS = [
  "#DBEAFE",
  "#FEE2E2",
  "#D1FAE5",
  "#FEF3C7",
  "#EDE9FE",
  "#FCE7F3",
  "#CCFBF1",
  "#E5E7EB",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, color, archived } = body;

  const updateData: Record<string, string | boolean> = {};
  if (name !== undefined) {
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const existing = await prisma.framework.findFirst({
      where: { name: name.trim(), NOT: { id: parseInt(id) } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Framework name already exists" },
        { status: 409 }
      );
    }
    updateData.name = name.trim();
  }
  if (color !== undefined) {
    if (!color || typeof color !== "string" || !PRESET_COLORS.includes(color)) {
      return NextResponse.json(
        { error: "Valid color is required" },
        { status: 400 }
      );
    }
    updateData.color = color;
  }

  const oldFramework = await prisma.framework.findUnique({ where: { id: parseInt(id) } });

  if (archived !== undefined && typeof archived === "boolean" && oldFramework) {
    await prisma.$transaction(async (tx) => {
      await tx.framework.update({
        where: { id: parseInt(id) },
        data: { archived },
      });
      const programs = await tx.program.findMany({
        where: { frameworkId: parseInt(id) },
        select: { id: true },
      });
      const programIds = programs.map((p) => p.id);
      if (programIds.length > 0) {
        await tx.program.updateMany({
          where: { id: { in: programIds } },
          data: { archived },
        });
        const projects = await tx.project.findMany({
          where: { programId: { in: programIds } },
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
      }
    });
    await touchLastModified();
    const framework = await prisma.framework.findUnique({ where: { id: parseInt(id) } });
    await logChange({
      entityType: "Framework",
      entityId: parseInt(id),
      entityName: framework?.name || "",
      changeType: archived ? "archive" : "unarchive",
      details: archived ? "Archived framework and all child items" : "Unarchived framework and all child items",
    });
    return NextResponse.json(framework);
  }

  const framework = await prisma.framework.update({
    where: { id: parseInt(id) },
    data: updateData,
  });
  await touchLastModified();
  if (oldFramework) {
    const details = diffFields(oldFramework as Record<string, unknown>, updateData, ["name", "color"]);
    if (details) {
      await logChange({
        entityType: "Framework",
        entityId: framework.id,
        entityName: framework.name,
        changeType: "update",
        details,
      });
    }
  }
  return NextResponse.json(framework);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const programCount = await prisma.program.count({
    where: { frameworkId: parseInt(id) },
  });
  if (programCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete framework with attached programs" },
      { status: 400 }
    );
  }
  const framework = await prisma.framework.findUnique({ where: { id: parseInt(id) } });
  await prisma.framework.delete({ where: { id: parseInt(id) } });
  await touchLastModified();
  if (framework) {
    await logChange({
      entityType: "Framework",
      entityId: framework.id,
      entityName: framework.name,
      changeType: "delete",
      oldValue: framework.name,
    });
  }
  return NextResponse.json({ ok: true });
}
