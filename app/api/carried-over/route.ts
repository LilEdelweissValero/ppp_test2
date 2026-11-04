import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFieldsV2 } from "@/lib/audit-log";
import { requireEdit } from "@/lib/edit-auth";
import { isQuarterValid } from "@/lib/quarters";
import { carryOverData } from "@/lib/carry-over";

type ItemType = "task" | "special-task" | "such-task";
interface ItemRef {
  type: ItemType;
  id: number;
}

const TYPES: ItemType[] = ["task", "special-task", "such-task"];

function validItems(items: unknown): items is ItemRef[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((i) => i && TYPES.includes(i.type) && Number.isInteger(i.id))
  );
}

// Bulk actions for the Parking Lot:
//   { action: "pull",   items, projectId, quarter } re-parent into a project + set quarter + un-park
//   { action: "return", items }                     un-park in place (back to the current year)
export async function POST(request: NextRequest) {
  const blocked = await requireEdit();
  if (blocked) return blocked;
  const body = await request.json();
  const { action, items, projectId, quarter } = body;

  if (!validItems(items)) {
    return NextResponse.json({ error: "items are required" }, { status: 400 });
  }
  if (action !== "pull" && action !== "return") {
    return NextResponse.json({ error: "action must be 'pull' or 'return'" }, { status: 400 });
  }

  let targetId: number | null = null;
  if (action === "pull") {
    if (!quarter || !isQuarterValid(quarter)) {
      return NextResponse.json({ error: "A valid quarter is required" }, { status: 400 });
    }
    targetId = parseInt(projectId);
    const target = await prisma.project.findUnique({ where: { id: targetId } });
    if (!target || target.abandoned || target.carriedOverTo) {
      return NextResponse.json({ error: "Target project is not available" }, { status: 400 });
    }
  }

  const cleared = carryOverData(false);
  let done = 0;
  const touchedProjects = new Set<number>(); // original parents of items we un-park

  for (const ref of items) {
    if (ref.type === "task") {
      const t = await prisma.task.findUnique({ where: { id: ref.id } });
      if (!t || !t.carriedOverTo) continue;
      const data =
        action === "pull"
          ? { ...cleared, projectId: targetId!, phaseId: null, adjustedTargetQuarter: quarter }
          : cleared;
      await prisma.task.update({ where: { id: t.id }, data });
      touchedProjects.add(t.projectId);
      const name = `${t.taskCode}: ${t.name}`;
      if (action === "pull") {
        const details = diffFieldsV2(t as Record<string, unknown>, data, ["projectId", "phaseId", "adjustedTargetQuarter"]);
        if (details) await logChange({ entityType: "Task", entityId: t.id, entityName: name, changeType: "update", details });
      }
      await logChange({
        entityType: "Task",
        entityId: t.id,
        entityName: name,
        changeType: "uncarry_over",
        details: JSON.stringify({ to: t.carriedOverTo, via: action }),
      });
    } else if (ref.type === "special-task") {
      const t = await prisma.specialTask.findUnique({ where: { id: ref.id } });
      if (!t || !t.carriedOverTo) continue;
      const data =
        action === "pull"
          ? { ...cleared, projectId: targetId!, phaseId: null, dueQuarter: quarter }
          : cleared;
      await prisma.specialTask.update({ where: { id: t.id }, data });
      touchedProjects.add(t.projectId);
      const name = `${t.specialTaskCode}: ${t.name}`;
      if (action === "pull") {
        const details = diffFieldsV2(t as Record<string, unknown>, data, ["projectId", "phaseId", "dueQuarter"]);
        if (details) await logChange({ entityType: "SpecialTask", entityId: t.id, entityName: name, changeType: "update", details });
      }
      await logChange({
        entityType: "SpecialTask",
        entityId: t.id,
        entityName: name,
        changeType: "uncarry_over",
        details: JSON.stringify({ to: t.carriedOverTo, via: action }),
      });
    } else {
      const t = await prisma.suchTask.findUnique({ where: { id: ref.id } });
      if (!t || !t.carriedOverTo) continue;
      const data =
        action === "pull"
          ? { ...cleared, projectId: targetId!, phaseId: null, dueQuarter: quarter }
          : cleared;
      await prisma.suchTask.update({ where: { id: t.id }, data });
      touchedProjects.add(t.projectId);
      const name = `${t.suchTaskCode}: ${t.name}`;
      if (action === "pull") {
        const details = diffFieldsV2(t as Record<string, unknown>, data, ["projectId", "phaseId", "dueQuarter"]);
        if (details) await logChange({ entityType: "SuchTask", entityId: t.id, entityName: name, changeType: "update", details });
      }
      await logChange({
        entityType: "SuchTask",
        entityId: t.id,
        entityName: name,
        changeType: "uncarry_over",
        details: JSON.stringify({ to: t.carriedOverTo, via: action }),
      });
    }
    done++;
  }

  // A returned item needs a live parent: un-park its project if it was parked
  // (only projects whose items we just returned, never unrelated parked ones).
  if (action === "return" && touchedProjects.size > 0) {
    const parked = await prisma.project.findMany({
      where: { id: { in: [...touchedProjects] }, carriedOverTo: { not: null } },
      select: { id: true, name: true, carriedOverTo: true },
    });
    for (const p of parked) {
      const stillParked =
        (await prisma.task.count({ where: { projectId: p.id, carriedOverTo: { not: null } } })) +
        (await prisma.specialTask.count({ where: { projectId: p.id, carriedOverTo: { not: null } } })) +
        (await prisma.suchTask.count({ where: { projectId: p.id, carriedOverTo: { not: null } } }));
      const live =
        (await prisma.task.count({ where: { projectId: p.id, carriedOverTo: null } })) +
        (await prisma.specialTask.count({ where: { projectId: p.id, carriedOverTo: null } })) +
        (await prisma.suchTask.count({ where: { projectId: p.id, carriedOverTo: null } }));
      if (live > 0 || stillParked === 0) {
        await prisma.project.update({ where: { id: p.id }, data: cleared });
        await logChange({
          entityType: "Project",
          entityId: p.id,
          entityName: p.name,
          changeType: "uncarry_over",
          details: JSON.stringify({ to: p.carriedOverTo, via: "return" }),
        });
      }
    }
  }

  await touchLastModified();
  return NextResponse.json({ ok: true, updated: done });
}
