import { DEFAULT_STATUSES } from "./computation-settings";
import type { ComputationSettings, ComputationStatus } from "./computation-settings";

// ── Backward-compatible constants ──────────────────────────────────────────

export const STATUS_LABELS = [
  "Not Yet Started",
  "In Progress, Planning or Initiated",
  "In Progress, Partial",
  "In Progress, Mostly Done or Testing",
  "Complete or Verified",
] as const;

export type StatusLabel = (typeof STATUS_LABELS)[number];

export const STATUS_SCORES: Record<StatusLabel, number> = {
  "Not Yet Started": 0,
  "In Progress, Planning or Initiated": 25,
  "In Progress, Partial": 50,
  "In Progress, Mostly Done or Testing": 75,
  "Complete or Verified": 100,
};

export const PRIORITY_LABELS = ["Low", "Moderate", "High"] as const;

export type PriorityLabel = (typeof PRIORITY_LABELS)[number];

export type StatusCounts = Record<string, number>;

// ── Settings-aware helpers ─────────────────────────────────────────────────

export function getStatusList(
  settings?: ComputationSettings
): ComputationStatus[] {
  return settings?.statuses ?? DEFAULT_STATUSES;
}

export function getStatusNameById(
  id: string,
  settings?: ComputationSettings
): string {
  const list = getStatusList(settings);
  return list.find((s) => s.id === id)?.name ?? id;
}

export function getStatusIdByName(
  name: string,
  settings?: ComputationSettings
): string {
  const list = getStatusList(settings);
  return list.find((s) => s.name === name)?.id ?? name;
}

export function getStatusScore(
  name: string,
  settings?: ComputationSettings
): number {
  const list = getStatusList(settings);
  return list.find((s) => s.name === name)?.score ?? 0;
}

// ── Counting functions ─────────────────────────────────────────────────────

export function countTasksByStatus(
  tasks: { status: string }[],
  settings?: ComputationSettings
): StatusCounts {
  const list = getStatusList(settings);
  const counts: StatusCounts = {};
  for (const s of list) {
    counts[s.name] = 0;
  }
  for (const t of tasks) {
    if (t.status in counts) counts[t.status]++;
  }
  return counts;
}

export function countTasksByStatusForQuarter(
  tasks: { status: string; adjustedTargetQuarter: string }[],
  selectedQuarter: string,
  settings?: ComputationSettings
): StatusCounts {
  const filtered = tasks.filter(
    (t) => t.adjustedTargetQuarter === selectedQuarter
  );
  return countTasksByStatus(filtered, settings);
}
