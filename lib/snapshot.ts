import { prisma } from "@/lib/db";

// ── Types matching the dashboard data shape ──────────────────────────────────

interface SnapshotTask {
  id: number;
  taskCode: string;
  name: string;
  assignee: string | null;
  priority: string;
  status: string;
  description: string | null;
  targetQuarter: string;
  notes: string | null;
  deliverable: string | null;
  attachments: unknown;
  dependencies: string | null;
  adjustedTargetQuarter: string;
  archived: boolean;
}

interface SnapshotSpecialTask {
  id: number;
  specialTaskCode: string;
  name: string;
  sortOrder: number;
  total: number;
  nys: number;
  plan: number;
  part: number;
  mostly: number;
  done: number;
  dueQuarter: string;
  lastUpdatedDate: string | null;
  archived: boolean;
}

interface SnapshotProject {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  actualCompletionDate: string | null;
  archived: boolean;
  tasks: SnapshotTask[];
  specialTasks: SnapshotSpecialTask[];
}

interface SnapshotProgram {
  id: number;
  name: string;
  frameworkId: number;
  archived: boolean;
  projects: SnapshotProject[];
}

interface SnapshotFramework {
  id: number;
  name: string;
  color: string;
  archived: boolean;
  programs: SnapshotProgram[];
}

interface ChangeLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  remarks: string | null;
  createdAt: string;
}

// ── Diff string parser ───────────────────────────────────────────────────────
// Format: `field: "old" → "new"; field2: "old2" → "new2"`

function parseDiffString(details: string): Record<string, { old: string; new: string }> {
  const result: Record<string, { old: string; new: string }> = {};
  const parts = details.split("; ");
  for (const part of parts) {
    const colonIdx = part.indexOf(": ");
    if (colonIdx === -1) continue;
    const field = part.slice(0, colonIdx).trim();
    const valueStr = part.slice(colonIdx + 2);
    const arrowIdx = valueStr.indexOf(" → ");
    if (arrowIdx === -1) continue;
    const oldVal = valueStr.slice(0, arrowIdx).replace(/^"|"$/g, "").trim();
    const newVal = valueStr.slice(arrowIdx + 3).replace(/^"|"$/g, "").trim();
    result[field] = { old: oldVal, new: newVal };
  }
  return result;
}

// ── Snapshot reconstruction ──────────────────────────────────────────────────

export async function getSnapshotAt(timestamp: string): Promise<{
  frameworks: SnapshotFramework[];
  lastModifiedAt: string;
}> {
  const targetDate = new Date(timestamp);

  // Fetch current live data (all items, including archived)
  const [currentFrameworks, allLogs] = await Promise.all([
    prisma.framework.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        sortOrder: true,
        archived: true,
        programs: {
          select: {
            id: true,
            name: true,
            frameworkId: true,
            sortOrder: true,
            archived: true,
            projects: {
              select: {
                id: true,
                name: true,
                programId: true,
                reference: true,
                owner: true,
                targetQuarter: true,
                adjustedTargetQuarter: true,
                actualCompletionDate: true,
                sortOrder: true,
                archived: true,
                tasks: {
                  select: {
                    id: true,
                    projectId: true,
                    taskCode: true,
                    name: true,
                    assignee: true,
                    priority: true,
                    sortOrder: true,
                    description: true,
                    dependencies: true,
                    notes: true,
                    status: true,
                    targetQuarter: true,
                    adjustedTargetQuarter: true,
                    deliverable: true,
                    attachments: true,
                    archived: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
                specialTasks: {
                  select: {
                    id: true,
                    projectId: true,
                    specialTaskCode: true,
                    name: true,
                    sortOrder: true,
                    total: true,
                    nys: true,
                    plan: true,
                    part: true,
                    mostly: true,
                    done: true,
                    dueQuarter: true,
                    lastUpdatedDate: true,
                    archived: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.entityChangeLog.findMany({
      where: { createdAt: { gt: timestamp } },
      orderBy: { id: "asc" },
    }),
  ]);

  // If no changes after the timestamp, return current data as-is
  if (allLogs.length === 0) {
    return {
      frameworks: filterArchived(currentFrameworks),
      lastModifiedAt: timestamp,
    };
  }

  // Build lookup maps for quick access
  const frameworkMap = new Map(currentFrameworks.map((f) => [f.id, { ...f, programs: [...f.programs] }]));
  const programMap = new Map(currentFrameworks.flatMap((f) => f.programs.map((p) => [p.id, { ...p, projects: [...p.projects] }])));
  const projectMap = new Map(
    currentFrameworks.flatMap((f) =>
      f.programs.flatMap((p) =>
        p.projects.map((pr) => [pr.id, { ...pr, tasks: [...pr.tasks], specialTasks: [...pr.specialTasks] }])
      )
    )
  );
  const taskMap = new Map(
    currentFrameworks.flatMap((f) =>
      f.programs.flatMap((p) =>
        p.projects.flatMap((pr) => pr.tasks.map((t) => [t.id, { ...t }]))
      )
    )
  );
  const specialTaskMap = new Map(
    currentFrameworks.flatMap((f) =>
      f.programs.flatMap((p) =>
        p.projects.flatMap((pr) => pr.specialTasks.map((st) => [st.id, { ...st }]))
      )
    )
  );

  // Track entities that were created after the target timestamp (to hide them)
  const createdAfter = new Set<string>();
  // Track entities that were deleted after the target timestamp (to restore them)
  const deletedAfter = new Set<string>();

  // Process changes in chronological order (oldest first)
  for (const log of allLogs) {
    const entityKey = `${log.entityType}:${log.entityId}`;

    switch (log.changeType) {
      case "create": {
        // Entity was created AFTER our target timestamp — hide it
        createdAfter.add(entityKey);
        break;
      }
      case "delete": {
        // Entity was deleted AFTER our target timestamp — it existed at that time
        // Mark it as NOT created after (in case there's a create+delete after)
        createdAfter.delete(entityKey);
        deletedAfter.add(entityKey);
        break;
      }
      case "archive": {
        // Entity was archived AFTER our target timestamp — it wasn't archived at that time
        unarchiveEntity(log.entityType, log.entityId);
        break;
      }
      case "unarchive": {
        // Entity was unarchived AFTER our target timestamp — it was archived at that time
        archiveEntity(log.entityType, log.entityId);
        break;
      }
      case "update": {
        if (log.details) {
          applyUpdateReverse(log.entityType, log.entityId, log.details);
        }
        break;
      }
      case "status": {
        // Task status change — revert to oldValue
        const task = taskMap.get(log.entityId);
        if (task && log.oldValue) {
          task.status = log.oldValue;
        }
        break;
      }
      case "quarter": {
        // Task or Project quarter change — revert to oldValue
        const task = taskMap.get(log.entityId);
        if (task && log.oldValue) {
          task.adjustedTargetQuarter = log.oldValue;
        }
        const project = projectMap.get(log.entityId);
        if (project && log.oldValue) {
          project.adjustedTargetQuarter = log.oldValue;
        }
        break;
      }
      case "quarter_change": {
        // SpecialTask quarter change — revert to oldValue
        const st = specialTaskMap.get(log.entityId);
        if (st && log.oldValue) {
          st.dueQuarter = log.oldValue;
        }
        break;
      }
      // settings, reorder, import — no entity-specific reversal needed
    }
  }

  function unarchiveEntity(type: string, id: number) {
    if (type === "Framework") {
      const f = frameworkMap.get(id);
      if (f) f.archived = false;
    } else if (type === "Program") {
      const p = programMap.get(id);
      if (p) p.archived = false;
    } else if (type === "Project") {
      const p = projectMap.get(id);
      if (p) p.archived = false;
    } else if (type === "Task") {
      const t = taskMap.get(id);
      if (t) t.archived = false;
    } else if (type === "SpecialTask") {
      const st = specialTaskMap.get(id);
      if (st) st.archived = false;
    }
  }

  function archiveEntity(type: string, id: number) {
    if (type === "Framework") {
      const f = frameworkMap.get(id);
      if (f) f.archived = true;
    } else if (type === "Program") {
      const p = programMap.get(id);
      if (p) p.archived = true;
    } else if (type === "Project") {
      const p = projectMap.get(id);
      if (p) p.archived = true;
    } else if (type === "Task") {
      const t = taskMap.get(id);
      if (t) t.archived = true;
    } else if (type === "SpecialTask") {
      const st = specialTaskMap.get(id);
      if (st) st.archived = true;
    }
  }

  function applyUpdateReverse(type: string, id: number, details: string) {
    const changes = parseDiffString(details);
    if (type === "Framework") {
      const f = frameworkMap.get(id);
      if (f) {
        if (changes.name) f.name = changes.name.old;
        if (changes.color) f.color = changes.color.old;
      }
    } else if (type === "Program") {
      const p = programMap.get(id);
      if (p) {
        if (changes.name) p.name = changes.name.old;
      }
    } else if (type === "Project") {
      const p = projectMap.get(id);
      if (p) {
        if (changes.name) p.name = changes.name.old;
        if (changes.reference) p.reference = changes.reference.old || null;
        if (changes.owner) p.owner = changes.owner.old;
        if (changes.targetQuarter) p.targetQuarter = changes.targetQuarter.old;
        if (changes.adjustedTargetQuarter) p.adjustedTargetQuarter = changes.adjustedTargetQuarter.old;
        if (changes.actualCompletionDate) p.actualCompletionDate = changes.actualCompletionDate.old || null;
      }
    } else if (type === "Task") {
      const t = taskMap.get(id);
      if (t) {
        if (changes.taskCode) t.taskCode = changes.taskCode.old;
        if (changes.name) t.name = changes.name.old;
        if (changes.assignee) t.assignee = changes.assignee.old || null;
        if (changes.priority) t.priority = changes.priority.old;
        if (changes.status) t.status = changes.status.old;
        if (changes.description) t.description = changes.description.old || null;
        if (changes.dependencies) t.dependencies = changes.dependencies.old || null;
        if (changes.notes) t.notes = changes.notes.old || null;
        if (changes.deliverable) t.deliverable = changes.deliverable.old || null;
        if (changes.targetQuarter) t.targetQuarter = changes.targetQuarter.old;
        if (changes.adjustedTargetQuarter) t.adjustedTargetQuarter = changes.adjustedTargetQuarter.old;
      }
    } else if (type === "SpecialTask") {
      const st = specialTaskMap.get(id);
      if (st) {
        if (changes.specialTaskCode) st.specialTaskCode = changes.specialTaskCode.old;
        if (changes.name) st.name = changes.name.old;
        if (changes.total) st.total = parseInt(changes.total.old) || 0;
        if (changes.nys) st.nys = parseInt(changes.nys.old) || 0;
        if (changes.plan) st.plan = parseInt(changes.plan.old) || 0;
        if (changes.part) st.part = parseInt(changes.part.old) || 0;
        if (changes.mostly) st.mostly = parseInt(changes.mostly.old) || 0;
        if (changes.done) st.done = parseInt(changes.done.old) || 0;
        if (changes.dueQuarter) st.dueQuarter = changes.dueQuarter.old;
        if (changes.lastUpdatedDate) st.lastUpdatedDate = changes.lastUpdatedDate.old || null;
      }
    }
  }

  // Reconstruct the tree, excluding entities created after the target timestamp
  // and handling archive status
  const reconstructed: SnapshotFramework[] = [];

  for (const [fid, f] of frameworkMap) {
    if (createdAfter.has(`Framework:${fid}`)) continue;

    const programs: SnapshotProgram[] = [];
    for (const [pid, p] of programMap) {
      if (p.frameworkId !== fid) continue;
      if (createdAfter.has(`Program:${pid}`)) continue;

      const projects: SnapshotProject[] = [];
      for (const [prid, pr] of projectMap) {
        if (pr.programId !== pid) continue;
        if (createdAfter.has(`Project:${prid}`)) continue;

        const tasks: SnapshotTask[] = [];
        for (const [tid, t] of taskMap) {
          if (t.projectId !== prid) continue;
          if (createdAfter.has(`Task:${tid}`)) continue;
          tasks.push({
            id: t.id,
            taskCode: t.taskCode,
            name: t.name,
            assignee: t.assignee,
            priority: t.priority,
            status: t.status,
            description: t.description,
            targetQuarter: t.targetQuarter,
            notes: t.notes,
            deliverable: t.deliverable,
            attachments: t.attachments,
            dependencies: t.dependencies,
            adjustedTargetQuarter: t.adjustedTargetQuarter,
            archived: t.archived,
          });
        }

        const specialTasks: SnapshotSpecialTask[] = [];
        for (const [stid, st] of specialTaskMap) {
          if (st.projectId !== prid) continue;
          if (createdAfter.has(`SpecialTask:${stid}`)) continue;
          specialTasks.push({
            id: st.id,
            specialTaskCode: st.specialTaskCode,
            name: st.name,
            sortOrder: st.sortOrder,
            total: st.total,
            nys: st.nys,
            plan: st.plan,
            part: st.part,
            mostly: st.mostly,
            done: st.done,
            dueQuarter: st.dueQuarter,
            lastUpdatedDate: st.lastUpdatedDate,
            archived: st.archived,
          });
        }

        projects.push({
          id: pr.id,
          name: pr.name,
          programId: pr.programId,
          reference: pr.reference,
          owner: pr.owner,
          targetQuarter: pr.targetQuarter,
          adjustedTargetQuarter: pr.adjustedTargetQuarter,
          actualCompletionDate: pr.actualCompletionDate,
          archived: pr.archived,
          tasks,
          specialTasks,
        });
      }

      programs.push({
        id: p.id,
        name: p.name,
        frameworkId: p.frameworkId,
        archived: p.archived,
        projects,
      });
    }

    reconstructed.push({
      id: f.id,
      name: f.name,
      color: f.color,
      archived: f.archived,
      programs,
    });
  }

  return {
    frameworks: filterArchived(reconstructed),
    lastModifiedAt: timestamp,
  };
}

// ── Filter archived items (dashboard only shows non-archived) ────────────────

function filterArchived(frameworks: SnapshotFramework[]): SnapshotFramework[] {
  return frameworks
    .filter((f) => !f.archived)
    .map((f) => ({
      ...f,
      programs: f.programs
        .filter((p) => !p.archived)
        .map((p) => ({
          ...p,
          projects: p.projects
            .filter((pr) => !pr.archived)
            .map((pr) => ({
              ...pr,
              tasks: pr.tasks.filter((t) => !t.archived),
              specialTasks: pr.specialTasks.filter((st) => !st.archived),
            })),
        })),
    }));
}
