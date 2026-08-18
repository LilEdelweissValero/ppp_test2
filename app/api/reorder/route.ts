import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";

const VALID_TYPES = ["framework", "program", "project", "task"] as const;
type EntityType = (typeof VALID_TYPES)[number];

export async function PATCH(request: NextRequest) {
  let body: { entityType?: unknown; orderedIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { entityType, orderedIds } = body;

  if (!entityType || !VALID_TYPES.includes(entityType as EntityType)) {
    return NextResponse.json(
      { error: "Valid entityType is required (framework, program, project, task)" },
      { status: 400 }
    );
  }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json(
      { error: "orderedIds array is required" },
      { status: 400 }
    );
  }

  try {
    const updates = orderedIds.map((id: number, index: number) => {
      switch (entityType as EntityType) {
        case "framework":
          return prisma.framework.update({ where: { id }, data: { sortOrder: index } });
        case "program":
          return prisma.program.update({ where: { id }, data: { sortOrder: index } });
        case "project":
          return prisma.project.update({ where: { id }, data: { sortOrder: index } });
        case "task":
          return prisma.task.update({ where: { id }, data: { sortOrder: index } });
      }
    });

    await prisma.$transaction(updates);

    await touchLastModified();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reorder failed:", err);
    return NextResponse.json(
      { error: "Failed to save order" },
      { status: 500 }
    );
  }
}
