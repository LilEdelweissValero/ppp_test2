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

export function computeProjectPercentComplete(
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
