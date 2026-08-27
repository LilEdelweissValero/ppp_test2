import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { assignments } = body as {
    assignments: { taskId?: number; specialTaskId?: number; phaseId: number | null }[];
  };

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return NextResponse.json({ error: "assignments array is required" }, { status: 400 });
  }

  const errors: string[] = [];

  for (const a of assignments) {
    try {
      if (a.taskId) {
        const task = await prisma.task.findUnique({ where: { id: a.taskId } });
        if (!task) {
          errors.push(`Task ${a.taskId} not found`);
          continue;
        }
        await prisma.task.update({
          where: { id: a.taskId },
          data: { phaseId: a.phaseId },
        });
        await logChange({
          entityType: "Task",
          entityId: task.id,
          entityName: `${task.taskCode}: ${task.name}`,
          changeType: "update",
          details: JSON.stringify({ phaseId: { old: String(task.phaseId ?? ""), new: String(a.phaseId ?? "") } }),
        });
      } else if (a.specialTaskId) {
        const st = await prisma.specialTask.findUnique({ where: { id: a.specialTaskId } });
        if (!st) {
          errors.push(`SpecialTask ${a.specialTaskId} not found`);
          continue;
        }
        await prisma.specialTask.update({
          where: { id: a.specialTaskId },
          data: { phaseId: a.phaseId },
        });
        await logChange({
          entityType: "SpecialTask",
          entityId: st.id,
          entityName: `${st.specialTaskCode}: ${st.name}`,
          changeType: "update",
          details: JSON.stringify({ phaseId: { old: String(st.phaseId ?? ""), new: String(a.phaseId ?? "") } }),
        });
      }
    } catch (e) {
      errors.push(`Failed to update: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  await touchLastModified();

  if (errors.length > 0 && errors.length === assignments.length) {
    return NextResponse.json({ error: "All assignments failed", details: errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true, errors: errors.length > 0 ? errors : undefined });
}
