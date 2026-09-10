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
  abandoned: boolean;
}

interface SnapshotSuchTask {
  id: number;
  suchTaskCode: string;
  name: string;
  sortOrder: number;
  totalScheduled: number;
  sv: number;
  snv: number;
  nsv: number;
  dueQuarter: string;
  lastUpdatedDate: string | null;
  phaseId: number | null;
  abandoned: boolean;
}

interface SnapshotPhase {
  id: number;
  projectId: number;
  name: string;
  weight: number;
  sortOrder: number;
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
  abandoned: boolean;
  phases: SnapshotPhase[];
  tasks: SnapshotTask[];
  specialTasks: SnapshotSpecialTask[];
  suchTasks: SnapshotSuchTask[];
}

interface SnapshotProgram {
  id: number;
  name: string;
  frameworkId: number;
  abandoned: boolean;
  projects: SnapshotProject[];
}

interface SnapshotFramework {
  id: number;
  name: string;
  color: string;
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

export async function getSnapshotAt(timestamp: string, historical = false): Promise<{
  frameworks: SnapshotFramework[];
  lastModifiedAt: string;
  settings: ComputationSettings | null;
}> {
  const targetDate = new Date(timestamp);

  // Minute-precision boundary: revert only changes strictly after the end of
  // the chosen minute.  "As of 11:49" includes all changes during 11:49:xx.
  const minuteStart = Math.floor(targetDate.getTime() / 60000) * 60000;
  const revertAfter = new Date(minuteStart + 60000 - 1); // end of the chosen minute

  // Fetch current live data
  const [currentFrameworks, allLogs, allSettingsLogs] = await Promise.all([
    prisma.framework.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        sortOrder: true,
        programs: {
          select: {
            id: true,
            name: true,
            frameworkId: true,
            sortOrder: true,
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
                abandoned: true,
                phases: {
                  select: {
                    id: true,
                    projectId: true,
                    name: true,
                    weight: true,
                    sortOrder: true,
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
                    abandoned: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
                suchTasks: {
                  select: {
                    id: true,
                    projectId: true,
                    suchTaskCode: true,
                    name: true,
                    sortOrder: true,
                    totalScheduled: true,
                    sv: true,
                    snv: true,
                    nsv: true,
                    dueQuarter: true,
                    lastUpdatedDate: true,
                    phaseId: true,
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
      orderBy: { id: "desc" },
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
      frameworks: filterAbandoned(currentFrameworks, historical),
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
        p.projects.map((pr) => [pr.id, { ...pr, phases: [...pr.phases], tasks: [...pr.tasks], specialTasks: [...pr.specialTasks], suchTasks: [...pr.suchTasks] }])
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
  const suchTaskMap = new Map(
    currentFrameworks.flatMap((f) =>
      f.programs.flatMap((p) =>
        p.projects.flatMap((pr) => pr.suchTasks.map((st) => [st.id, { ...st }]))
      )
    )
  );

  // Track entities that were created after the target timestamp (to hide them)
  const createdAfter = new Set<string>();

  // Process changes in reverse chronological order (newest first) to correctly undo them
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
              for (const st of pr.suchTasks) st.abandoned = false;
            }
          }
        } else if (log.entityType === "Project") {
          const pr = projectMap.get(log.entityId);
          if (pr) {
            pr.abandoned = false;
            for (const t of pr.tasks) t.abandoned = false;
            for (const st of pr.specialTasks) st.abandoned = false;
            for (const st of pr.suchTasks) st.abandoned = false;
          }
        } else if (log.entityType === "Task") {
          const t = taskMap.get(log.entityId);
          if (t) t.abandoned = false;
        } else if (log.entityType === "SpecialTask") {
          const st = specialTaskMap.get(log.entityId);
          if (st) st.abandoned = false;
        } else if (log.entityType === "SuchTask") {
          const st = suchTaskMap.get(log.entityId);
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
              for (const st of pr.suchTasks) st.abandoned = true;
            }
          }
        } else if (log.entityType === "Project") {
          const pr = projectMap.get(log.entityId);
          if (pr) {
            pr.abandoned = true;
            for (const t of pr.tasks) t.abandoned = true;
            for (const st of pr.specialTasks) st.abandoned = true;
            for (const st of pr.suchTasks) st.abandoned = true;
          }
        } else if (log.entityType === "Task") {
          const t = taskMap.get(log.entityId);
          if (t) t.abandoned = true;
        } else if (log.entityType === "SpecialTask") {
          const st = specialTaskMap.get(log.entityId);
          if (st) st.abandoned = true;
        } else if (log.entityType === "SuchTask") {
          const st = suchTaskMap.get(log.entityId);
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
        } else if (log.entityType === "SuchTask") {
          const st = suchTaskMap.get(log.entityId);
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
            } else if (tableType === "SuchTask") {
              for (let i = 0; i < prevOrder.length; i++) {
                const st = suchTaskMap.get(prevOrder[i]);
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
      }
    } else if (type === "Phase") {
      const ph = phaseMap.get(id);
      if (ph) {
        if (changes.name) ph.name = changes.name.old;
        if (changes.weight) ph.weight = parseFloat(changes.weight.old) || 0;
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
    } else if (type === "SuchTask") {
      const st = suchTaskMap.get(id);
      if (st) {
        if (changes.suchTaskCode) st.suchTaskCode = changes.suchTaskCode.old;
        if (changes.name) st.name = changes.name.old;
        if (changes.totalScheduled) st.totalScheduled = parseInt(changes.totalScheduled.old) || 0;
        if (changes.sv) st.sv = parseInt(changes.sv.old) || 0;
        if (changes.snv) st.snv = parseInt(changes.snv.old) || 0;
        if (changes.nsv) st.nsv = parseInt(changes.nsv.old) || 0;
        if (changes.dueQuarter) st.dueQuarter = changes.dueQuarter.old;
        if (changes.lastUpdatedDate) st.lastUpdatedDate = changes.lastUpdatedDate.old || null;
      }
    }
  }

  // Reconstruct the tree, excluding entities created after the target timestamp
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
            abandoned: t.abandoned,
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
            abandoned: st.abandoned,
          });
        }

        const suchTasks: SnapshotSuchTask[] = [];
        for (const [stid, st] of suchTaskMap) {
          if (st.projectId !== prid) continue;
          if (createdAfter.has(`SuchTask:${stid}`)) continue;
          suchTasks.push({
            id: st.id,
            suchTaskCode: st.suchTaskCode,
            name: st.name,
            sortOrder: st.sortOrder,
            totalScheduled: st.totalScheduled,
            sv: st.sv,
            snv: st.snv,
            nsv: st.nsv,
            dueQuarter: st.dueQuarter,
            lastUpdatedDate: st.lastUpdatedDate,
            phaseId: st.phaseId,
            abandoned: st.abandoned,
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
          abandoned: pr.abandoned,
          phases,
          tasks,
          specialTasks,
          suchTasks,
        });
      }

      programs.push({
        id: p.id,
        name: p.name,
        frameworkId: p.frameworkId,
        abandoned: p.abandoned,
        projects,
      });
    }

    reconstructed.push({
      id: f.id,
      name: f.name,
      color: f.color,
      programs,
    });
  }

  // Reconstruct historical settings from the latest settings log entry at or before T.
  // newValue = the settings in effect after that save, which is what the user expects
  // to see when viewing "as of" a given time.  oldValue would be one version behind.
  let historicalSettings: ComputationSettings | null = null;
  if (allSettingsLogs.length > 0) {
    const latestSettingsLog = allSettingsLogs[0];
    const raw = latestSettingsLog.newValue || latestSettingsLog.oldValue;
    if (raw) {
      try {
        historicalSettings = JSON.parse(raw);
      } catch {
        // Malformed — fall back to null (current settings)
      }
    }
  }

  return {
    frameworks: filterAbandoned(reconstructed, historical),
    lastModifiedAt: timestamp,
    settings: historicalSettings,
  };
}

// ── Filter abandoned items (dashboard only shows active) ────────────────────

function filterAbandoned(frameworks: SnapshotFramework[], historical = false): SnapshotFramework[] {
  if (historical) return frameworks;
  return frameworks
    .map((f) => ({
      ...f,
      programs: f.programs
        .filter((p) => !p.abandoned)
        .map((p) => ({
          ...p,
          projects: p.projects
            .filter((pr) => !pr.abandoned)
            .map((pr) => ({
              ...pr,
              phases: pr.phases,
              tasks: pr.tasks.filter((t) => !t.abandoned),
              specialTasks: pr.specialTasks.filter((st) => !st.abandoned),
              suchTasks: pr.suchTasks.filter((st) => !st.abandoned),
            })),
        })),
    }));
}
