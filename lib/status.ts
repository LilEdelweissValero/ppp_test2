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

export const ENTITY_TYPES = ["Project", "Task"] as const;

export type StatusCounts = Record<StatusLabel, number>;

export function countTasksByStatus(
  tasks: { status: string }[]
): StatusCounts {
  const counts: StatusCounts = {
    "Not Yet Started": 0,
    "In Progress, Planning or Initiated": 0,
    "In Progress, Partial": 0,
    "In Progress, Mostly Done or Testing": 0,
    "Complete or Verified": 0,
  };
  for (const t of tasks) {
    if (t.status in counts) counts[t.status as StatusLabel]++;
  }
  return counts;
}

export function countTasksByStatusForQuarter(
  tasks: { status: string; adjustedTargetQuarter: string }[],
  selectedQuarter: string
): StatusCounts {
  const filtered = tasks.filter(
    (t) => t.adjustedTargetQuarter === selectedQuarter
  );
  return countTasksByStatus(filtered);
}
