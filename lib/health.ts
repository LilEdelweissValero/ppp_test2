import {
  computeHealthFromRules,
  DEFAULT_HEALTH_RULES,
  DEFAULT_STATUSES,
} from "./computation-settings";
import type { ComputationSettings } from "./computation-settings";

export type HealthStatus =
  | "Completed"
  | "Not Yet Due"
  | "On Time"
  | "At Risk"
  | "Delayed";

export function computeProjectHealth(
  percentComplete: number,
  adjustedTargetQuarter: string,
  settings?: ComputationSettings
): string {
  const rules = settings?.healthRules ?? DEFAULT_HEALTH_RULES;
  return computeHealthFromRules(rules, percentComplete, adjustedTargetQuarter);
}

export function computeTaskPercentDone(
  status: string,
  settings?: ComputationSettings
): number {
  const statuses = settings?.statuses ?? DEFAULT_STATUSES;
  const found = statuses.find((s) => s.name === status);
  return (found?.score ?? 0) / 100;
}

export function computePhasePercentComplete(
  tasks: { status: string }[],
  settings?: ComputationSettings
): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce(
    (sum, t) => sum + computeTaskPercentDone(t.status, settings),
    0
  );
  return total / tasks.length;
}

export function computeProjectPercentComplete(
  tasks: { status: string }[],
  settings?: ComputationSettings,
  phases?: { id: number; weight: number }[],
  allTasks?: { status: string; phaseId: number | null }[]
): number {
  if (tasks.length === 0) return 0;

  // If phases exist, use weighted computation
  if (phases && phases.length > 0 && allTasks) {
    let totalWeighted = 0;
    for (const phase of phases) {
      const phaseTasks = allTasks.filter((t) => t.phaseId === phase.id);
      if (phaseTasks.length > 0) {
        const phaseAvg = computePhasePercentComplete(phaseTasks, settings);
        totalWeighted += phaseAvg * (phase.weight / 100);
      }
    }
    return totalWeighted;
  }

  // Fallback: existing logic (average of all tasks)
  const total = tasks.reduce(
    (sum, t) => sum + computeTaskPercentDone(t.status, settings),
    0
  );
  return total / tasks.length;
}

// ── Expand special tasks into virtual tasks ──────────────────────────────────

export interface SpecialTaskInput {
  id: number;
  specialTaskCode: string;
  name: string;
  nys: number;
  plan: number;
  part: number;
  mostly: number;
  done: number;
  dueQuarter: string;
  phaseId: number | null;
}

export interface VirtualTask {
  id: number;
  status: string;
  phaseId: number | null;
}

export function expandSpecialTasksToVirtualTasks(
  specialTasks: SpecialTaskInput[],
  settings?: ComputationSettings
): VirtualTask[] {
  const statuses = settings?.statuses ?? DEFAULT_STATUSES;
  const virtuals: VirtualTask[] = [];
  for (const st of specialTasks) {
    const counts = [
      { count: st.nys, status: statuses[0].name },
      { count: st.plan, status: statuses[1].name },
      { count: st.part, status: statuses[2].name },
      { count: st.mostly, status: statuses[3].name },
      { count: st.done, status: statuses[4].name },
    ];
    for (const { count, status } of counts) {
      for (let i = 0; i < count; i++) {
        virtuals.push({
          id: -(st.id * 100 + virtuals.length),
          status,
          phaseId: st.phaseId,
        });
      }
    }
  }
  return virtuals;
}

// ── SUCH task computation ────────────────────────────────────────────────────

export interface SuchTaskInput {
  id: number;
  suchTaskCode: string;
  name: string;
  sv: number;
  snv: number;
  nsv: number;
  dueQuarter: string;
  phaseId: number | null;
}

export function computeSuchTaskPercent(sv: number, snv: number, nsv: number): number {
  const denominator = sv + snv;
  if (denominator === 0) return 0;
  return Math.min(Math.round(((sv + nsv) / denominator) * 100), 100);
}

export function expandSuchTasksToVirtualTasks(
  suchTasks: SuchTaskInput[],
  settings?: ComputationSettings
): VirtualTask[] {
  const statuses = settings?.statuses ?? DEFAULT_STATUSES;
  const virtuals: VirtualTask[] = [];
  for (const st of suchTasks) {
    const pct = computeSuchTaskPercent(st.sv, st.snv, st.nsv);
    let statusName: string;
    if (pct === 100) statusName = statuses[4].name;
    else if (pct >= 75) statusName = statuses[3].name;
    else if (pct >= 50) statusName = statuses[2].name;
    else if (pct > 0) statusName = statuses[1].name;
    else statusName = statuses[0].name;
    virtuals.push({
      id: -(st.id * 1000 + virtuals.length),
      status: statusName,
      phaseId: st.phaseId,
    });
  }
  return virtuals;
}

export function computeProjectDerivedStatus(
  tasks: { status: string }[],
  settings?: ComputationSettings
): "In Progress" | "Completed" {
  if (tasks.length === 0) return "In Progress";
  const doneId = settings?.statuses[4]?.name ?? "Complete or Verified";
  return tasks.every((t) => t.status === doneId)
    ? "Completed"
    : "In Progress";
}
