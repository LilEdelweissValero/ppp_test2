import { prisma } from "@/lib/db";
import { parseDetails } from "@/lib/audit-log";
import type { ComputationSettings } from "@/lib/computation-settings";

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
  phaseId: number | null;
  archived: boolean;
  abandoned: boolean;
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
  phaseId: number | null;
  archived: boolean;
  abandoned: boolean;
}

interface SnapshotPhase {
  id: number;
  projectId: number;
  name: string;
  weight: number;
  sortOrder: number;
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
  phasesTableName: string | null;
  archived: boolean;
  abandoned: boolean;
  phases: SnapshotPhase[];
  tasks: SnapshotTask[];
  specialTasks: SnapshotSpecialTask[];
}

interface SnapshotProgram {
  id: number;
  name: string;
  frameworkId: number;
  archived: boolean;
  abandoned: boolean;
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

// ── Snapshot reconstruction ──────────────────────────────────────────────────

export async function getSnapshotAt(timestamp: string): Promise<{
  frameworks: SnapshotFramework[];
  lastModifiedAt: string;
  settings: ComputationSettings | null;
}> {
  const targetDate = new Date(timestamp);

  // Minute-precision boundary: revert only changes strictly after the end of
  // the chosen minute.  "As of 11:49" includes all changes during 11:49:xx.
  const minuteStart = Math.floor(targetDate.getTime() / 60000) * 60000;
  const revertAfter = new Date(minuteStart + 60000 - 1); // end of the chosen minute

  // Fetch current live data (all items, including archived)
  const [currentFrameworks, allLogs, allSettingsLogs] = await Promise.all([
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
            abandoned: true,
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
                phasesTableName: true,
                sortOrder: true,
                archived: true,
                abandoned: true,
                phases: {
                  select: {
                    id: true,
                    projectId: true,
                    name: true,
                    weight: true,
                    sortOrder: true,
                    archived: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
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
                    phaseId: true,
                    archived: true,
                    abandoned: true,
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
                    phaseId: true,
                    archived: true,
                    abandoned: true,
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
      where: { createdAt: { gt: revertAfter.toISOString() } },
      orderBy: { id: "asc" },
    }),
    prisma.entityChangeLog.findMany({
      where: {
        changeType: "settings",
        createdAt: { lte: revertAfter.toISOString() },
      },
      orderBy: { id: "desc" },
      take: 1,
    }),
  ]);

  // If no changes after the boundary, return current data as-is
  if (allLogs.length === 0) {
    return {
      frameworks: filterArchived(currentFrameworks),
      lastModifiedAt: timestamp,
      settings: null, // null = use current settings
    };
  }

  // Build lookup maps for quick access
  const frameworkMap = new Map(currentFrameworks.map((f) => [f.id, { ...f, programs: [...f.programs] }]));
  const programMap = new Map(currentFrameworks.flatMap((f) => f.programs.map((p) => [p.id, { ...p, projects: [...p.projects] }])));
  const projectMap = new Map(
    currentFrameworks.flatMap((f) =>
      f.programs.flatMap((p) =>
        p.projects.map((pr) => [pr.id, { ...pr, phases: [...pr.phases], tasks: [...pr.tasks], specialTasks: [...pr.specialTasks] }])
      )
    )
  );
  const phaseMap = new Map(
    currentFrameworks.flatMap((f) =>
      f.programs.flatMap((p) =>
        p.projects.flatMap((pr) => pr.phases.map((ph) => [ph.id, { ...ph }]))
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
        // Entity was deleted AFTER our target timestamp — remove from createdAfter
        // (it existed before T even if also created before T)
        createdAfter.delete(entityKey);
        break;
      }
      case "archive": {
        if (log.entityType === "Project") {
          // Project archived AFTER T → it wasn't archived at T
          unarchiveEntity("Project", log.entityId);
          // Cascade: also unarchive all tasks of this project (legacy single-entry)
          const pr = projectMap.get(log.entityId);
          if (pr) {
            for (const t of pr.tasks) {
              unarchiveEntity("Task", t.id);
            }
            for (const st of pr.specialTasks) {
              unarchiveEntity("SpecialTask", st.id);
            }
          }
        } else {
          unarchiveEntity(log.entityType, log.entityId);
        }
        break;
      }
      case "unarchive": {
        if (log.entityType === "Project") {
          // Project unarchived AFTER T → it was archived at T
          archiveEntity("Project", log.entityId);
          // Cascade: also archive all tasks of this project (legacy single-entry)
          const pr = projectMap.get(log.entityId);
          if (pr) {
            for (const t of pr.tasks) {
              archiveEntity("Task", t.id);
            }
            for (const st of pr.specialTasks) {
              archiveEntity("SpecialTask", st.id);
            }
          }
        } else {
          archiveEntity(log.entityType, log.entityId);
        }
        break;
      }
      case "abandon": {
        // Entity was abandoned AFTER T → it wasn't abandoned at T
        if (log.entityType === "Program") {
          const p = programMap.get(log.entityId);
          if (p) {
            p.abandoned = false;
            for (const pr of p.projects) {
              pr.abandoned = false;
              for (const t of pr.tasks) t.abandoned = false;
              for (const st of pr.specialTasks) st.abandoned = false;
            }
          }
        } else if (log.entityType === "Project") {
          const pr = projectMap.get(log.entityId);
          if (pr) {
            pr.abandoned = false;
            for (const t of pr.tasks) t.abandoned = false;
            for (const st of pr.specialTasks) st.abandoned = false;
          }
        } else if (log.entityType === "Task") {
          const t = taskMap.get(log.entityId);
          if (t) t.abandoned = false;
        } else if (log.entityType === "SpecialTask") {
          const st = specialTaskMap.get(log.entityId);
          if (st) st.abandoned = false;
        }
        break;
      }
      case "unabandon": {
        // Entity was un-abandoned AFTER T → it was abandoned at T
        if (log.entityType === "Program") {
          const p = programMap.get(log.entityId);
          if (p) {
            p.abandoned = true;
            for (const pr of p.projects) {
              pr.abandoned = true;
              for (const t of pr.tasks) t.abandoned = true;
              for (const st of pr.specialTasks) st.abandoned = true;
            }
          }
        } else if (log.entityType === "Project") {
          const pr = projectMap.get(log.entityId);
          if (pr) {
            pr.abandoned = true;
            for (const t of pr.tasks) t.abandoned = true;
            for (const st of pr.specialTasks) st.abandoned = true;
          }
        } else if (log.entityType === "Task") {
          const t = taskMap.get(log.entityId);
          if (t) t.abandoned = true;
        } else if (log.entityType === "SpecialTask") {
          const st = specialTaskMap.get(log.entityId);
          if (st) st.abandoned = true;
        }
        break;
      }
      case "update": {
        if (log.details) {
          applyUpdateReverse(log.entityType, log.entityId, log.details);
        }
        break;
      }
      case "status": {
        if (log.entityType === "Task") {
          const task = taskMap.get(log.entityId);
          if (task && log.oldValue) {
            task.status = log.oldValue;
          }
        }
        break;
      }
      case "quarter": {
        if (log.entityType === "Task") {
          const task = taskMap.get(log.entityId);
          if (task && log.oldValue) {
            task.adjustedTargetQuarter = log.oldValue;
          }
        } else if (log.entityType === "Project") {
          const project = projectMap.get(log.entityId);
          if (project && log.oldValue) {
            project.adjustedTargetQuarter = log.oldValue;
          }
        }
        break;
      }
      case "quarter_change": {
        if (log.entityType === "SpecialTask") {
          const st = specialTaskMap.get(log.entityId);
          if (st && log.oldValue) {
            st.dueQuarter = log.oldValue;
          }
        } else if (log.entityType === "Task") {
          const task = taskMap.get(log.entityId);
          if (task && log.oldValue) {
            task.adjustedTargetQuarter = log.oldValue;
          }
        } else if (log.entityType === "Project") {
          const project = projectMap.get(log.entityId);
          if (project && log.oldValue) {
            project.adjustedTargetQuarter = log.oldValue;
          }
        }
        break;
      }
      case "reorder": {
        // Restore previous ordering from oldValue (JSON array of IDs)
        if (log.oldValue && log.entityType) {
          try {
            const prevOrder: number[] = JSON.parse(log.oldValue);
            const tableType = log.entityType;
            if (tableType === "Task") {
              for (let i = 0; i < prevOrder.length; i++) {
                const t = taskMap.get(prevOrder[i]);
                if (t) t.sortOrder = i;
              }
            } else if (tableType === "SpecialTask") {
              for (let i = 0; i < prevOrder.length; i++) {
                const st = specialTaskMap.get(prevOrder[i]);
                if (st) st.sortOrder = i;
              }
            } else if (tableType === "Phase") {
              for (let i = 0; i < prevOrder.length; i++) {
                const ph = phaseMap.get(prevOrder[i]);
                if (ph) ph.sortOrder = i;
              }
            } else if (tableType === "Project") {
              for (let i = 0; i < prevOrder.length; i++) {
                const pr = projectMap.get(prevOrder[i]);
                if (pr) pr.sortOrder = i;
              }
            } else if (tableType === "Program") {
              for (let i = 0; i < prevOrder.length; i++) {
                const p = programMap.get(prevOrder[i]);
                if (p) p.sortOrder = i;
              }
            } else if (tableType === "Framework") {
              for (let i = 0; i < prevOrder.length; i++) {
                const f = frameworkMap.get(prevOrder[i]);
                if (f) f.sortOrder = i;
              }
            }
          } catch {
            // Malformed JSON — skip reorder revert
          }
        }
        break;
      }
      // settings, import — no entity-specific reversal needed
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
    } else if (type === "Phase") {
      const ph = phaseMap.get(id);
      if (ph) ph.archived = false;
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
    } else if (type === "Phase") {
      const ph = phaseMap.get(id);
      if (ph) ph.archived = true;
    } else if (type === "Task") {
      const t = taskMap.get(id);
      if (t) t.archived = true;
    } else if (type === "SpecialTask") {
      const st = specialTaskMap.get(id);
      if (st) st.archived = true;
    }
  }

  function applyUpdateReverse(type: string, id: number, details: string) {
    const changes = parseDetails(details);
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
        if (changes.phasesTableName) p.phasesTableName = changes.phasesTableName.old || null;
        if (changes.archived) p.archived = changes.archived.old === "true";
      }
    } else if (type === "Phase") {
      const ph = phaseMap.get(id);
      if (ph) {
        if (changes.name) ph.name = changes.name.old;
        if (changes.weight) ph.weight = parseFloat(changes.weight.old) || 0;
        if (changes.archived) ph.archived = changes.archived.old === "true";
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
        if (changes.archived) t.archived = changes.archived.old === "true";
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
        if (changes.archived) st.archived = changes.archived.old === "true";
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
            phaseId: t.phaseId,
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
            phaseId: st.phaseId,
            archived: st.archived,
          });
        }

        const phases: SnapshotPhase[] = [];
        for (const [phid, ph] of phaseMap) {
          if (ph.projectId !== prid) continue;
          if (createdAfter.has(`Phase:${phid}`)) continue;
          phases.push({
            id: ph.id,
            projectId: ph.projectId,
            name: ph.name,
            weight: ph.weight,
            sortOrder: ph.sortOrder,
            archived: ph.archived,
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
          phasesTableName: pr.phasesTableName,
          archived: pr.archived,
          phases,
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

  // Reconstruct historical settings from the latest settings log entry at or before T
  let historicalSettings: ComputationSettings | null = null;
  if (allSettingsLogs.length > 0) {
    const latestSettingsLog = allSettingsLogs[0];
    if (latestSettingsLog.oldValue) {
      try {
        historicalSettings = JSON.parse(latestSettingsLog.oldValue);
      } catch {
        // Malformed — fall back to null (current settings)
      }
    }
  }

  return {
    frameworks: filterArchived(reconstructed),
    lastModifiedAt: timestamp,
    settings: historicalSettings,
  };
}

// ── Filter archived/abandoned items (dashboard only shows active) ────────────

function filterArchived(frameworks: SnapshotFramework[]): SnapshotFramework[] {
  return frameworks
    .filter((f) => !f.archived)
    .map((f) => ({
      ...f,
      programs: f.programs
        .filter((p) => !p.archived && !p.abandoned)
        .map((p) => ({
          ...p,
          projects: p.projects
            .filter((pr) => !pr.archived && !pr.abandoned)
            .map((pr) => ({
              ...pr,
              phases: pr.phases.filter((ph) => !ph.archived),
              tasks: pr.tasks.filter((t) => !t.archived && !t.abandoned),
              specialTasks: pr.specialTasks.filter((st) => !st.archived && !st.abandoned),
            })),
        })),
    }));
}
