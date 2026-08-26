import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";
import { getSettings } from "@/lib/computation-settings-server";
import { isQuarterValid } from "@/lib/quarters";
import type { Prisma } from "@/app/generated/prisma/client";

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

const PRIORITIES = ["Low", "Moderate", "High"];

const ALLOWED_MOVES = new Set([
  "framework>program",
  "program>framework",
  "program>project",
  "project>program",
  "project>task",
  "task>project",
]);

interface AllocEntry {
  itemType: "task" | "specialTask";
  itemId: number;
  projectId: number;
}

interface FieldBag {
  targetQuarter?: unknown;
  taskCode?: unknown;
  status?: unknown;
  priority?: unknown;
  color?: unknown;
  reference?: unknown;
  owner?: unknown;
}

interface TaskFieldValues {
  taskCode: string;
  status: string;
  priority: string;
}

function bad(error: string, status = 400, conflicts?: string[]) {
  return NextResponse.json(conflicts ? { error, conflicts } : { error }, { status });
}

function intOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  return typeof n === "number" && Number.isInteger(n) ? n : null;
}

function parseIds(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const ids: number[] = [];
  for (const item of v) {
    const n = intOrNull(item);
    if (n === null) return null;
    ids.push(n);
  }
  return [...new Set(ids)];
}

function parseFields(v: unknown): Map<number, FieldBag> {
  const map = new Map<number, FieldBag>();
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!/^\d+$/.test(k)) continue;
      if (val && typeof val === "object") map.set(parseInt(k, 10), val as FieldBag);
    }
  }
  return map;
}

function parseAllocs(v: unknown): AllocEntry[] {
  if (!Array.isArray(v)) return [];
  const out: AllocEntry[] = [];
  for (const a of v) {
    if (!a || typeof a !== "object") continue;
    const itemId = intOrNull((a as AllocEntry).itemId);
    const projectId = intOrNull((a as AllocEntry).projectId);
    const itemType = (a as AllocEntry).itemType;
    if (itemId === null || projectId === null) continue;
    if (itemType !== "task" && itemType !== "specialTask") continue;
    out.push({ itemType, itemId, projectId });
  }
  return out;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function quarterOrError(bag: FieldBag, label: string, conflicts: string[]): string | null {
  const q = str(bag.targetQuarter);
  if (!q || !isQuarterValid(q)) {
    conflicts.push(`${label}: pick a valid target quarter`);
    return null;
  }
  return q;
}

async function validateTaskFields(
  bag: FieldBag,
  label: string,
  validStatuses: Set<string>,
  conflicts: string[]
): Promise<TaskFieldValues | null> {
  const taskCode = str(bag.taskCode);
  const status = str(bag.status);
  const priority = str(bag.priority);
  if (!taskCode) conflicts.push(`${label}: enter a task code`);
  if (!status || !validStatuses.has(status)) conflicts.push(`${label}: pick a valid status`);
  if (!priority || !PRIORITIES.includes(priority)) {
    conflicts.push(`${label}: priority must be Low, Moderate or High`);
  }
  if (!taskCode || !status || !priority || !PRIORITIES.includes(priority)) return null;
  if (!validStatuses.has(status)) return null;
  return { taskCode, status, priority };
}

async function validateTaskCodes(
  codeMap: Map<number, string>,
  labelFor: (id: number) => string,
  conflicts: string[]
): Promise<void> {
  const seen = new Map<string, number>();
  for (const [id, code] of codeMap) {
    const prev = seen.get(code);
    if (prev !== undefined) {
      conflicts.push(`Task code "${code}" is used by both ${labelFor(prev)} and ${labelFor(id)}`);
    } else {
      seen.set(code, id);
    }
  }
  const codeList = [...codeMap.values()];
  if (codeList.length === 0) return;
  const takenCodes = await prisma.task.findMany({
    where: { taskCode: { in: codeList } },
    select: { taskCode: true },
  });
  const taken = new Set(takenCodes.map((t) => t.taskCode));
  for (const [id, code] of codeMap) {
    if (taken.has(code)) conflicts.push(`Task code "${code}" (${labelFor(id)}) already exists`);
  }
}

interface DisplacedRef {
  itemType: "task" | "specialTask";
  id: number;
  archived: boolean;
  groupId: number;
}

function buildDisplaced(
  tasks: { id: number; archived: boolean; projectId: number }[],
  specials: { id: number; archived: boolean; projectId: number }[]
): DisplacedRef[] {
  return [
    ...tasks.map((t) => ({ itemType: "task" as const, id: t.id, archived: t.archived, groupId: t.projectId })),
    ...specials.map((s) => ({
      itemType: "specialTask" as const,
      id: s.id,
      archived: s.archived,
      groupId: s.projectId,
    })),
  ];
}

function validateAllocations(
  displaced: DisplacedRef[],
  allocList: AllocEntry[],
  isValidTarget: (projectId: number) => boolean,
  conflicts: string[]
): void {
  const missing = displaced.filter(
    (d) => !d.archived && !allocList.some((a) => a.itemType === d.itemType && a.itemId === d.id)
  );
  if (missing.length > 0) {
    conflicts.push(
      `${missing.length} displaced item${missing.length !== 1 ? "s" : ""} still need${
        missing.length === 1 ? "s" : ""
      } a target project`
    );
  }
  const seen = new Set<string>();
  let invalidTarget = false;
  for (const a of allocList) {
    const key = `${a.itemType}:${a.itemId}`;
    if (seen.has(key)) {
      conflicts.push("Duplicate allocation entries found");
    }
    seen.add(key);
    if (!isValidTarget(a.projectId)) invalidTarget = true;
  }
  if (invalidTarget) {
    conflicts.push("One or more allocation targets are not valid projects after this change");
  }
}

async function reallocateDisplaced(
  tx: Prisma.TransactionClient,
  displaced: DisplacedRef[],
  allocList: AllocEntry[],
  resolveTarget: (projectId: number) => number | undefined,
  fallbackTargetId: () => number | undefined
): Promise<{ tasksReassigned: number; specialTasksReassigned: number }> {
  if (displaced.length === 0) return { tasksReassigned: 0, specialTasksReassigned: 0 };

  const allocByItem = new Map(allocList.map((a) => [`${a.itemType}:${a.itemId}`, a]));
  const groupTargets = new Map<number, number>();

  for (const d of displaced) {
    if (d.archived) continue;
    const alloc = allocByItem.get(`${d.itemType}:${d.id}`);
    if (!alloc) continue;
    const resolved = resolveTarget(alloc.projectId);
    if (resolved === undefined) continue;
    if (!groupTargets.has(d.groupId)) groupTargets.set(d.groupId, resolved);
  }

  const assigned = new Map<DisplacedRef, number>();
  let fallback: number | undefined;

  for (const d of displaced) {
    let target: number | undefined;
    if (!d.archived) {
      const alloc = allocByItem.get(`${d.itemType}:${d.id}`);
      if (alloc) target = resolveTarget(alloc.projectId);
    }
    if (target === undefined) target = groupTargets.get(d.groupId);
    if (target === undefined) {
      if (fallback === undefined) fallback = fallbackTargetId();
      target = fallback;
    }
    if (target === undefined) return { tasksReassigned: 0, specialTasksReassigned: 0 };
    assigned.set(d, target);
  }

  const targetIds = [...new Set(assigned.values())];
  const taskMaxes = await tx.task.groupBy({
    by: ["projectId"],
    _max: { sortOrder: true },
    where: { projectId: { in: targetIds } },
  });
  const nextSort = new Map<number, number>();
  for (const row of taskMaxes) nextSort.set(row.projectId, (row._max.sortOrder ?? 0) + 1);
  const stMaxes = await tx.specialTask.groupBy({
    by: ["projectId"],
    _max: { sortOrder: true },
    where: { projectId: { in: targetIds } },
  });
  for (const row of stMaxes) {
    nextSort.set(-row.projectId, (row._max.sortOrder ?? 0) + 1);
  }

  let tasksReassigned = 0;
  let specialTasksReassigned = 0;
  for (const [d, target] of assigned) {
    if (d.itemType === "task") {
      const sort = nextSort.get(target) ?? 1;
      nextSort.set(target, sort + 1);
      await tx.task.update({ where: { id: d.id }, data: { projectId: target, sortOrder: sort } });
      tasksReassigned++;
    } else {
      const sortKey = -target;
      const sort = nextSort.get(sortKey) ?? 1;
      nextSort.set(sortKey, sort + 1);
      await tx.specialTask.update({
        where: { id: d.id },
        data: { projectId: target, sortOrder: sort },
      });
      specialTasksReassigned++;
    }
  }
  return { tasksReassigned, specialTasksReassigned };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const sourceType = String(body.sourceType ?? "");
  const targetType = String(body.targetType ?? "");
  const moveKey = `${sourceType}>${targetType}`;
  if (!ALLOWED_MOVES.has(moveKey)) {
    return bad("Items can only move one level up or down");
  }

  const itemIds = parseIds(body.itemIds);
  if (!itemIds) return bad("itemIds array with valid ids is required");

  const fieldMap = parseFields(body.fields);
  const allocList = parseAllocs(body.allocations);

  try {
    switch (moveKey) {
      case "framework>program":
        return await frameworkToProgram(itemIds, fieldMap, allocList, body.destinationParentId);
      case "program>framework":
        return await programToFramework(itemIds, fieldMap, allocList);
      case "program>project":
        return await programToProject(itemIds, fieldMap, allocList, body.destinationParentId);
      case "project>program":
        return await projectToProgram(itemIds, fieldMap, allocList, body.destinationParentId);
      case "project>task":
        return await projectToTask(itemIds, fieldMap, allocList, body.destinationParentId);
      case "task>project":
        return await taskToProject(itemIds, fieldMap, body.destinationParentId);
      default:
        return bad("Unsupported level change");
    }
  } catch (err) {
    console.error("Level change failed:", err);
    const message = err instanceof Error ? err.message : "Failed to change level";
    return bad(message, 500);
  }
}

async function frameworkToProgram(
  itemIds: number[],
  fieldMap: Map<number, FieldBag>,
  allocList: AllocEntry[],
  destRaw: unknown
) {
  const destId = intOrNull(destRaw);
  if (destId === null) return bad("A destination framework is required");
  if (itemIds.includes(destId)) return bad("Destination cannot be one of the items being changed");
  const destFramework = await prisma.framework.findUnique({ where: { id: destId } });
  if (!destFramework) return bad("Destination framework not found", 404);

  const frameworks = await prisma.framework.findMany({
    where: { id: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  if (frameworks.length !== itemIds.length) return bad("One or more frameworks not found", 404);

  const programs = await prisma.program.findMany({
    where: { frameworkId: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  const programIds = programs.map((p) => p.id);
  const projects = programIds.length
    ? await prisma.project.findMany({ where: { programId: { in: programIds } }, orderBy: { sortOrder: "asc" } })
    : [];
  const projectIds = projects.map((p) => p.id);
  const tasks = projectIds.length
    ? await prisma.task.findMany({ where: { projectId: { in: projectIds } }, orderBy: { sortOrder: "asc" } })
    : [];
  const specials = projectIds.length
    ? await prisma.specialTask.findMany({ where: { projectId: { in: projectIds } } })
    : [];

  const settings = await getSettings();
  const validStatuses = new Set(settings.statuses.map((s) => s.name));

  const conflicts: string[] = [];
  const existingProgs = await prisma.program.findMany({
    where: { name: { in: frameworks.map((f) => f.name) } },
    select: { name: true },
  });
  for (const f of frameworks) {
    if (existingProgs.some((p) => p.name === f.name)) {
      conflicts.push(`A program named "${f.name}" already exists`);
    }
  }

  const quarters = new Map<number, string>();
  for (const p of programs) {
    const q = quarterOrError(fieldMap.get(p.id) ?? {}, `Program "${p.name}"`, conflicts);
    if (q) quarters.set(p.id, q);
  }

  const taskFields = new Map<number, TaskFieldValues>();
  const codeMap = new Map<number, string>();
  for (const proj of projects) {
    const validated = await validateTaskFields(
      fieldMap.get(proj.id) ?? {},
      `Project "${proj.name}"`,
      validStatuses,
      conflicts
    );
    if (validated) {
      taskFields.set(proj.id, validated);
      codeMap.set(proj.id, validated.taskCode);
    }
  }
  await validateTaskCodes(
    codeMap,
    (id) => `project "${projects.find((p) => p.id === id)?.name ?? id}"`,
    conflicts
  );

  const allProjects = await prisma.project.findMany({ select: { id: true } });
  const deletedProjectIds = new Set(projectIds);
  const survivorIds = new Set(allProjects.map((p) => p.id).filter((id) => !deletedProjectIds.has(id)));
  const displaced = buildDisplaced(tasks, specials);
  validateAllocations(displaced, allocList, (pid) => survivorIds.has(pid) || programIds.includes(pid), conflicts);

  if (conflicts.length > 0) return bad("Validation failed", 409, conflicts);

  const programsByFramework = new Map<number, typeof programs>();
  for (const p of programs) {
    const list = programsByFramework.get(p.frameworkId) ?? [];
    list.push(p);
    programsByFramework.set(p.frameworkId, list);
  }
  const projectsByProgram = new Map<number, typeof projects>();
  for (const p of projects) {
    const list = projectsByProgram.get(p.programId) ?? [];
    list.push(p);
    projectsByProgram.set(p.programId, list);
  }

  let summary = { tasksReassigned: 0, specialTasksReassigned: 0 };
  const rootResults: {
    newId: number;
    name: string;
    convertedPrograms: number;
    convertedProjects: number;
  }[] = [];

  await prisma.$transaction(async (tx) => {
    const maxProg = await tx.program.aggregate({
      _max: { sortOrder: true },
      where: { frameworkId: destId },
    });
    let progSort = maxProg._max.sortOrder ?? 0;

    const fwToProg = new Map<number, number>();
    for (const f of frameworks) {
      progSort++;
      const created = await tx.program.create({
        data: { name: f.name, frameworkId: destId, sortOrder: progSort, archived: f.archived },
      });
      fwToProg.set(f.id, created.id);
    }

    const progToProj = new Map<number, number>();
    for (const f of frameworks) {
      let pjSort = 0;
      for (const p of programsByFramework.get(f.id) ?? []) {
        pjSort++;
        const created = await tx.project.create({
          data: {
            name: p.name,
            programId: fwToProg.get(f.id)!,
            reference: null,
            owner: null,
            targetQuarter: quarters.get(p.id)!,
            adjustedTargetQuarter: quarters.get(p.id)!,
            actualCompletionDate: null,
            archived: p.archived,
            sortOrder: pjSort,
          },
        });
        progToProj.set(p.id, created.id);
      }
    }

    for (const p of programs) {
      let tSort = 0;
      for (const proj of projectsByProgram.get(p.id) ?? []) {
        tSort++;
        const tf = taskFields.get(proj.id)!;
        await tx.task.create({
          data: {
            taskCode: tf.taskCode,
            name: proj.name,
            projectId: progToProj.get(p.id)!,
            assignee: null,
            priority: tf.priority,
            description: null,
            dependencies: null,
            notes: null,
            status: tf.status,
            targetQuarter: proj.targetQuarter,
            adjustedTargetQuarter: proj.adjustedTargetQuarter,
            deliverable: proj.reference,
            archived: proj.archived,
            sortOrder: tSort,
          },
        });
      }
    }

    const firstNewProject = progToProj.values().next().value as number | undefined;
    summary = await reallocateDisplaced(
      tx,
      displaced,
      allocList,
      (pid) => (survivorIds.has(pid) ? pid : progToProj.get(pid)),
      () => firstNewProject
    );

    for (const f of frameworks) {
      await tx.framework.delete({ where: { id: f.id } });
      const fwPrograms = programsByFramework.get(f.id) ?? [];
      rootResults.push({
        newId: fwToProg.get(f.id)!,
        name: f.name,
        convertedPrograms: fwPrograms.length,
        convertedProjects: fwPrograms.reduce(
          (acc, p) => acc + (projectsByProgram.get(p.id)?.length ?? 0),
          0
        ),
      });
    }
  });

  for (const r of rootResults) {
    await logChange({
      entityType: "Program",
      entityId: r.newId,
      entityName: r.name,
      changeType: "level-change",
      oldValue: `Framework: ${r.name}`,
      newValue: `Program under ${destFramework.name}`,
      details: JSON.stringify({
        from: "Framework",
        to: "Program",
        destination: destFramework.name,
        convertedPrograms: r.convertedPrograms,
        convertedProjects: r.convertedProjects,
        tasksReassigned: summary.tasksReassigned,
        specialTasksReassigned: summary.specialTasksReassigned,
      }),
    });
  }
  await touchLastModified();
  return NextResponse.json({ ok: true });
}

async function programToFramework(
  itemIds: number[],
  fieldMap: Map<number, FieldBag>,
  allocList: AllocEntry[]
) {
  const programs = await prisma.program.findMany({
    where: { id: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  if (programs.length !== itemIds.length) return bad("One or more programs not found", 404);

  const projects = await prisma.project.findMany({
    where: { programId: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  const projectIds = projects.map((p) => p.id);
  const tasks = projectIds.length
    ? await prisma.task.findMany({ where: { projectId: { in: projectIds } }, orderBy: { sortOrder: "asc" } })
    : [];
  const specials = projectIds.length
    ? await prisma.specialTask.findMany({ where: { projectId: { in: projectIds } } })
    : [];

  const conflicts: string[] = [];
  const existingFws = await prisma.framework.findMany({
    where: { name: { in: programs.map((p) => p.name) } },
    select: { name: true },
  });
  for (const p of programs) {
    if (existingFws.some((f) => f.name === p.name)) {
      conflicts.push(`A framework named "${p.name}" already exists`);
    }
    const color = str(fieldMap.get(p.id)?.color);
    if (!PRESET_COLORS.includes(color)) {
      conflicts.push(`"${p.name}": pick a color for the new framework`);
    }
  }

  const allProjects = await prisma.project.findMany({ select: { id: true } });
  const deletedProjectIds = new Set(projectIds);
  const survivorIds = new Set(allProjects.map((p) => p.id).filter((id) => !deletedProjectIds.has(id)));
  const newProjectFromTaskIds = new Set(tasks.map((t) => t.id));
  const displaced = buildDisplaced([], specials);
  validateAllocations(displaced, allocList, (pid) => survivorIds.has(pid) || newProjectFromTaskIds.has(pid), conflicts);

  if (conflicts.length > 0) return bad("Validation failed", 409, conflicts);

  const projectsByProgram = new Map<number, typeof projects>();
  for (const p of projects) {
    const list = projectsByProgram.get(p.programId) ?? [];
    list.push(p);
    projectsByProgram.set(p.programId, list);
  }
  const tasksByProject = new Map<number, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }

  let summary = { tasksReassigned: 0, specialTasksReassigned: 0 };
  const rootResults: { newId: number; name: string; convertedProjects: number; convertedTasks: number }[] = [];

  await prisma.$transaction(async (tx) => {
    const maxFw = await tx.framework.aggregate({ _max: { sortOrder: true } });
    let fwSort = maxFw._max.sortOrder ?? 0;

    const progToFw = new Map<number, number>();
    for (const p of programs) {
      fwSort++;
      const created = await tx.framework.create({
        data: { name: p.name, color: str(fieldMap.get(p.id)?.color), sortOrder: fwSort, archived: p.archived },
      });
      progToFw.set(p.id, created.id);
    }

    const projToProg = new Map<number, number>();
    for (const p of programs) {
      let pgSort = 0;
      for (const proj of projectsByProgram.get(p.id) ?? []) {
        pgSort++;
        const created = await tx.program.create({
          data: { name: proj.name, frameworkId: progToFw.get(p.id)!, sortOrder: pgSort, archived: proj.archived },
        });
        projToProg.set(proj.id, created.id);
      }
    }

    const taskToProj = new Map<number, number>();
    for (const proj of projects) {
      let pjSort = 0;
      for (const t of tasksByProject.get(proj.id) ?? []) {
        pjSort++;
        const bag = fieldMap.get(t.id) ?? {};
        const created = await tx.project.create({
          data: {
            name: t.name,
            programId: projToProg.get(proj.id)!,
            reference: str(bag.reference) || null,
            owner: str(bag.owner) || null,
            targetQuarter: t.targetQuarter,
            adjustedTargetQuarter: t.adjustedTargetQuarter,
            actualCompletionDate: null,
            archived: t.archived,
            sortOrder: pjSort,
          },
        });
        taskToProj.set(t.id, created.id);
      }
    }

    const firstNewProject = taskToProj.values().next().value as number | undefined;
    summary = await reallocateDisplaced(
      tx,
      displaced,
      allocList,
      (pid) => (survivorIds.has(pid) ? pid : taskToProj.get(pid)),
      () => firstNewProject
    );

    for (const p of programs) {
      await tx.program.delete({ where: { id: p.id } });
      const childProjects = projectsByProgram.get(p.id) ?? [];
      rootResults.push({
        newId: progToFw.get(p.id)!,
        name: p.name,
        convertedProjects: childProjects.length,
        convertedTasks: childProjects.reduce(
          (acc, proj) => acc + (tasksByProject.get(proj.id)?.length ?? 0),
          0
        ),
      });
    }
  });

  for (const r of rootResults) {
    await logChange({
      entityType: "Framework",
      entityId: r.newId,
      entityName: r.name,
      changeType: "level-change",
      oldValue: `Program: ${r.name}`,
      newValue: "Framework",
      details: JSON.stringify({
        from: "Program",
        to: "Framework",
        convertedProjects: r.convertedProjects,
        convertedTasks: r.convertedTasks,
        specialTasksReassigned: summary.specialTasksReassigned,
      }),
    });
  }
  await touchLastModified();
  return NextResponse.json({ ok: true });
}

async function programToProject(
  itemIds: number[],
  fieldMap: Map<number, FieldBag>,
  allocList: AllocEntry[],
  destRaw: unknown
) {
  const destId = intOrNull(destRaw);
  if (destId === null) return bad("A destination program is required");
  if (itemIds.includes(destId)) return bad("Destination cannot be one of the items being changed");
  const destProgram = await prisma.program.findUnique({ where: { id: destId } });
  if (!destProgram) return bad("Destination program not found", 404);

  const programs = await prisma.program.findMany({
    where: { id: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  if (programs.length !== itemIds.length) return bad("One or more programs not found", 404);

  const projects = await prisma.project.findMany({
    where: { programId: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  const projectIds = projects.map((p) => p.id);
  const tasks = projectIds.length
    ? await prisma.task.findMany({ where: { projectId: { in: projectIds } }, orderBy: { sortOrder: "asc" } })
    : [];
  const specials = projectIds.length
    ? await prisma.specialTask.findMany({ where: { projectId: { in: projectIds } } })
    : [];

  const settings = await getSettings();
  const validStatuses = new Set(settings.statuses.map((s) => s.name));

  const conflicts: string[] = [];
  const quarters = new Map<number, string>();
  for (const p of programs) {
    const q = quarterOrError(fieldMap.get(p.id) ?? {}, `Program "${p.name}"`, conflicts);
    if (q) quarters.set(p.id, q);
  }

  const taskFields = new Map<number, TaskFieldValues>();
  const codeMap = new Map<number, string>();
  for (const proj of projects) {
    const validated = await validateTaskFields(
      fieldMap.get(proj.id) ?? {},
      `Project "${proj.name}"`,
      validStatuses,
      conflicts
    );
    if (validated) {
      taskFields.set(proj.id, validated);
      codeMap.set(proj.id, validated.taskCode);
    }
  }
  await validateTaskCodes(
    codeMap,
    (id) => `project "${projects.find((p) => p.id === id)?.name ?? id}"`,
    conflicts
  );

  const allProjects = await prisma.project.findMany({ select: { id: true } });
  const deletedProjectIds = new Set(projectIds);
  const survivorIds = new Set(allProjects.map((p) => p.id).filter((id) => !deletedProjectIds.has(id)));
  const displaced = buildDisplaced(tasks, specials);
  validateAllocations(displaced, allocList, (pid) => survivorIds.has(pid) || itemIds.includes(pid), conflicts);

  if (conflicts.length > 0) return bad("Validation failed", 409, conflicts);

  const projectsByProgram = new Map<number, typeof projects>();
  for (const p of projects) {
    const list = projectsByProgram.get(p.programId) ?? [];
    list.push(p);
    projectsByProgram.set(p.programId, list);
  }
  const tasksByProject = new Map<number, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }

  let summary = { tasksReassigned: 0, specialTasksReassigned: 0 };
  const rootResults: { newId: number; name: string; convertedProjects: number }[] = [];

  await prisma.$transaction(async (tx) => {
    const maxProj = await tx.project.aggregate({
      _max: { sortOrder: true },
      where: { programId: destId },
    });
    let pjSort = maxProj._max.sortOrder ?? 0;

    const progToProj = new Map<number, number>();
    for (const p of programs) {
      pjSort++;
      const q = quarters.get(p.id)!;
      const created = await tx.project.create({
        data: {
          name: p.name,
          programId: destId,
          reference: null,
          owner: null,
          targetQuarter: q,
          adjustedTargetQuarter: q,
          actualCompletionDate: null,
          archived: p.archived,
          sortOrder: pjSort,
        },
      });
      progToProj.set(p.id, created.id);
    }

    for (const p of programs) {
      let tSort = 0;
      for (const proj of projectsByProgram.get(p.id) ?? []) {
        tSort++;
        const tf = taskFields.get(proj.id)!;
        await tx.task.create({
          data: {
            taskCode: tf.taskCode,
            name: proj.name,
            projectId: progToProj.get(p.id)!,
            assignee: null,
            priority: tf.priority,
            description: null,
            dependencies: null,
            notes: null,
            status: tf.status,
            targetQuarter: proj.targetQuarter,
            adjustedTargetQuarter: proj.adjustedTargetQuarter,
            deliverable: proj.reference,
            archived: proj.archived,
            sortOrder: tSort,
          },
        });
      }
    }

    const firstNewProject = progToProj.values().next().value as number | undefined;
    summary = await reallocateDisplaced(
      tx,
      displaced,
      allocList,
      (pid) => (survivorIds.has(pid) ? pid : progToProj.get(pid)),
      () => firstNewProject
    );

    for (const p of programs) {
      await tx.program.delete({ where: { id: p.id } });
      rootResults.push({
        newId: progToProj.get(p.id)!,
        name: p.name,
        convertedProjects: (projectsByProgram.get(p.id) ?? []).length,
      });
    }
  });

  for (const r of rootResults) {
    await logChange({
      entityType: "Project",
      entityId: r.newId,
      entityName: r.name,
      changeType: "level-change",
      oldValue: `Program: ${r.name}`,
      newValue: `Project under ${destProgram.name}`,
      details: JSON.stringify({
        from: "Program",
        to: "Project",
        destination: destProgram.name,
        convertedProjects: r.convertedProjects,
        tasksReassigned: summary.tasksReassigned,
        specialTasksReassigned: summary.specialTasksReassigned,
      }),
    });
  }
  await touchLastModified();
  return NextResponse.json({ ok: true });
}

async function projectToProgram(
  itemIds: number[],
  fieldMap: Map<number, FieldBag>,
  allocList: AllocEntry[],
  destRaw: unknown
) {
  const destId = intOrNull(destRaw);
  if (destId === null) return bad("A destination framework is required");
  const destFramework = await prisma.framework.findUnique({ where: { id: destId } });
  if (!destFramework) return bad("Destination framework not found", 404);

  const projects = await prisma.project.findMany({
    where: { id: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  if (projects.length !== itemIds.length) return bad("One or more projects not found", 404);

  const tasks = await prisma.task.findMany({
    where: { projectId: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  const specials = await prisma.specialTask.findMany({ where: { projectId: { in: itemIds } } });

  const conflicts: string[] = [];
  const existingProgs = await prisma.program.findMany({
    where: { name: { in: projects.map((p) => p.name) } },
    select: { name: true },
  });
  const batchNames = new Set<string>();
  for (const proj of projects) {
    if (existingProgs.some((pg) => pg.name === proj.name)) {
      conflicts.push(`A program named "${proj.name}" already exists`);
    }
    if (batchNames.has(proj.name)) {
      conflicts.push(`Multiple selected projects are named "${proj.name}"; program names must be unique`);
    }
    batchNames.add(proj.name);
  }

  const allProjects = await prisma.project.findMany({ select: { id: true } });
  const deletedProjectIds = new Set(itemIds);
  const survivorIds = new Set(allProjects.map((p) => p.id).filter((id) => !deletedProjectIds.has(id)));
  const newProjectFromTaskIds = new Set(tasks.map((t) => t.id));
  const displaced = buildDisplaced([], specials);
  validateAllocations(displaced, allocList, (pid) => survivorIds.has(pid) || newProjectFromTaskIds.has(pid), conflicts);

  if (conflicts.length > 0) return bad("Validation failed", 409, conflicts);

  const tasksByProject = new Map<number, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }

  let summary = { tasksReassigned: 0, specialTasksReassigned: 0 };
  const rootResults: { newId: number; name: string; convertedTasks: number }[] = [];

  await prisma.$transaction(async (tx) => {
    const maxProg = await tx.program.aggregate({
      _max: { sortOrder: true },
      where: { frameworkId: destId },
    });
    let pgSort = maxProg._max.sortOrder ?? 0;

    const projToProg = new Map<number, number>();
    for (const proj of projects) {
      pgSort++;
      const created = await tx.program.create({
        data: { name: proj.name, frameworkId: destId, sortOrder: pgSort, archived: proj.archived },
      });
      projToProg.set(proj.id, created.id);
    }

    const taskToProj = new Map<number, number>();
    for (const proj of projects) {
      let pjSort = 0;
      for (const t of tasksByProject.get(proj.id) ?? []) {
        pjSort++;
        const bag = fieldMap.get(t.id) ?? {};
        const created = await tx.project.create({
          data: {
            name: t.name,
            programId: projToProg.get(proj.id)!,
            reference: str(bag.reference) || null,
            owner: str(bag.owner) || null,
            targetQuarter: t.targetQuarter,
            adjustedTargetQuarter: t.adjustedTargetQuarter,
            actualCompletionDate: null,
            archived: t.archived,
            sortOrder: pjSort,
          },
        });
        taskToProj.set(t.id, created.id);
      }
    }

    const firstNewProject = taskToProj.values().next().value as number | undefined;
    summary = await reallocateDisplaced(
      tx,
      displaced,
      allocList,
      (pid) => (survivorIds.has(pid) ? pid : taskToProj.get(pid)),
      () => firstNewProject
    );

    for (const proj of projects) {
      await tx.project.delete({ where: { id: proj.id } });
      rootResults.push({
        newId: projToProg.get(proj.id)!,
        name: proj.name,
        convertedTasks: (tasksByProject.get(proj.id) ?? []).length,
      });
    }
  });

  for (const r of rootResults) {
    await logChange({
      entityType: "Program",
      entityId: r.newId,
      entityName: r.name,
      changeType: "level-change",
      oldValue: `Project: ${r.name}`,
      newValue: `Program under ${destFramework.name}`,
      details: JSON.stringify({
        from: "Project",
        to: "Program",
        destination: destFramework.name,
        convertedTasks: r.convertedTasks,
        specialTasksReassigned: summary.specialTasksReassigned,
      }),
    });
  }
  await touchLastModified();
  return NextResponse.json({ ok: true });
}

async function projectToTask(
  itemIds: number[],
  fieldMap: Map<number, FieldBag>,
  allocList: AllocEntry[],
  destRaw: unknown
) {
  const destId = intOrNull(destRaw);
  if (destId === null) return bad("A destination project is required");
  if (itemIds.includes(destId)) return bad("Destination cannot be one of the items being changed");
  const destProject = await prisma.project.findUnique({ where: { id: destId } });
  if (!destProject) return bad("Destination project not found", 404);

  const projects = await prisma.project.findMany({
    where: { id: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  if (projects.length !== itemIds.length) return bad("One or more projects not found", 404);

  const tasks = await prisma.task.findMany({
    where: { projectId: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  const specials = await prisma.specialTask.findMany({ where: { projectId: { in: itemIds } } });

  const settings = await getSettings();
  const validStatuses = new Set(settings.statuses.map((s) => s.name));

  const conflicts: string[] = [];
  const taskFields = new Map<number, TaskFieldValues>();
  const codeMap = new Map<number, string>();
  for (const proj of projects) {
    const validated = await validateTaskFields(
      fieldMap.get(proj.id) ?? {},
      `Project "${proj.name}"`,
      validStatuses,
      conflicts
    );
    if (validated) {
      taskFields.set(proj.id, validated);
      codeMap.set(proj.id, validated.taskCode);
    }
  }
  await validateTaskCodes(
    codeMap,
    (id) => `project "${projects.find((p) => p.id === id)?.name ?? id}"`,
    conflicts
  );

  const allProjects = await prisma.project.findMany({ select: { id: true } });
  const deletedProjectIds = new Set(itemIds);
  const survivorIds = new Set(allProjects.map((p) => p.id).filter((id) => !deletedProjectIds.has(id)));
  const displaced = buildDisplaced(tasks, specials);
  validateAllocations(displaced, allocList, (pid) => survivorIds.has(pid), conflicts);

  if (conflicts.length > 0) return bad("Validation failed", 409, conflicts);

  const tasksByProject = new Map<number, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }

  let summary = { tasksReassigned: 0, specialTasksReassigned: 0 };
  const rootResults: { newId: number; name: string; reassignedFromHere: number }[] = [];

  await prisma.$transaction(async (tx) => {
    const maxTask = await tx.task.aggregate({
      _max: { sortOrder: true },
      where: { projectId: destId },
    });
    let tSort = maxTask._max.sortOrder ?? 0;

    const projToTask = new Map<number, number>();
    for (const proj of projects) {
      tSort++;
      const tf = taskFields.get(proj.id)!;
      const created = await tx.task.create({
        data: {
          taskCode: tf.taskCode,
          name: proj.name,
          projectId: destId,
          assignee: proj.owner,
          priority: tf.priority,
          description: null,
          dependencies: null,
          notes: null,
          status: tf.status,
          targetQuarter: proj.targetQuarter,
          adjustedTargetQuarter: proj.adjustedTargetQuarter,
          deliverable: proj.reference,
          archived: proj.archived,
          sortOrder: tSort,
        },
      });
      projToTask.set(proj.id, created.id);
    }

    summary = await reallocateDisplaced(
      tx,
      displaced,
      allocList,
      (pid) => (survivorIds.has(pid) ? pid : undefined),
      () => destId
    );

    for (const proj of projects) {
      await tx.project.delete({ where: { id: proj.id } });
      rootResults.push({
        newId: projToTask.get(proj.id)!,
        name: proj.name,
        reassignedFromHere: (tasksByProject.get(proj.id) ?? []).length + (specials.filter((s) => s.projectId === proj.id)).length,
      });
    }
  });

  for (const r of rootResults) {
    await logChange({
      entityType: "Task",
      entityId: r.newId,
      entityName: r.name,
      changeType: "level-change",
      oldValue: `Project: ${r.name}`,
      newValue: `Task under ${destProject.name}`,
      details: JSON.stringify({
        from: "Project",
        to: "Task",
        destination: destProject.name,
        tasksReassigned: summary.tasksReassigned,
        specialTasksReassigned: summary.specialTasksReassigned,
      }),
    });
  }
  await touchLastModified();
  return NextResponse.json({ ok: true });
}

async function taskToProject(itemIds: number[], fieldMap: Map<number, FieldBag>, destRaw: unknown) {
  const destId = intOrNull(destRaw);
  if (destId === null) return bad("A destination program is required");
  const destProgram = await prisma.program.findUnique({ where: { id: destId } });
  if (!destProgram) return bad("Destination program not found", 404);

  const tasks = await prisma.task.findMany({
    where: { id: { in: itemIds } },
    orderBy: { sortOrder: "asc" },
  });
  if (tasks.length !== itemIds.length) return bad("One or more tasks not found", 404);

  const rootResults: { newId: number; name: string }[] = [];

  await prisma.$transaction(async (tx) => {
    const maxProj = await tx.project.aggregate({
      _max: { sortOrder: true },
      where: { programId: destId },
    });
    let pjSort = maxProj._max.sortOrder ?? 0;

    for (const t of tasks) {
      pjSort++;
      const bag = fieldMap.get(t.id) ?? {};
      const created = await tx.project.create({
        data: {
          name: t.name,
          programId: destId,
          reference: str(bag.reference) || t.taskCode,
          owner: str(bag.owner) || t.assignee,
          targetQuarter: t.targetQuarter,
          adjustedTargetQuarter: t.adjustedTargetQuarter,
          actualCompletionDate: null,
          archived: t.archived,
          sortOrder: pjSort,
        },
      });
      rootResults.push({ newId: created.id, name: t.name });
    }
    for (const t of tasks) {
      await tx.task.delete({ where: { id: t.id } });
    }
  });

  for (let i = 0; i < rootResults.length; i++) {
    const r = rootResults[i];
    const t = tasks[i];
    await logChange({
      entityType: "Project",
      entityId: r.newId,
      entityName: r.name,
      changeType: "level-change",
      oldValue: `Task ${t.taskCode}: ${t.name}`,
      newValue: `Project under ${destProgram.name}`,
      details: JSON.stringify({ from: "Task", to: "Project", destination: destProgram.name }),
    });
  }
  await touchLastModified();
  return NextResponse.json({ ok: true });
}
