import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

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
  const ids = orderedIds.filter(
    (id): id is number => typeof id === "number" && Number.isInteger(id)
  );
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "orderedIds must contain valid ids" },
      { status: 400 }
    );
  }

  const tableByType: Record<EntityType, string> = {
    framework: "Framework",
    program: "Program",
    project: "Project",
    task: "Task",
  };

  try {
    const table = tableByType[entityType as EntityType];

    // Fetch existing order before update for audit log
    const existingRows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT "id" FROM "${table}" WHERE "id" IN (${ids.join(", ")}) ORDER BY "sort_order" ASC`
    );
    const existingOrder = existingRows.map((r: { id: number }) => r.id);

    const cases = ids.map((id, index) => `WHEN ${id} THEN ${index}`).join(" ");
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "sort_order" = CASE "id" ${cases} END WHERE "id" IN (${ids.join(", ")})`
    );

    await touchLastModified();

    await logChange({
      entityType: table,
      entityId: 0,
      entityName: `${table} reorder`,
      changeType: "reorder",
      oldValue: JSON.stringify(existingOrder),
      newValue: JSON.stringify(ids),
      details: `Reordered ${ids.length} ${table.toLowerCase()}s`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reorder failed:", err);
    const message = err instanceof Error ? err.message : "Failed to save order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
