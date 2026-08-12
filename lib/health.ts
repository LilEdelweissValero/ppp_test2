import { compareQuarters, currentQuarter } from "./quarters";

export type HealthStatus =
  | "Completed"
  | "Not Yet Due"
  | "On Time"
  | "At Risk"
  | "Delayed";

export function computeProjectHealth(
  percentComplete: number,
  adjustedTargetQuarter: string
): HealthStatus {
  if (percentComplete === 100) return "Completed";
  if (compareQuarters(adjustedTargetQuarter, currentQuarter()) > 0) {
    return "Not Yet Due";
  }
  if (percentComplete >= 75) return "On Time";
  if (percentComplete >= 50) return "At Risk";
  return "Delayed";
}

export function computeTaskPercentDone(status: string): number {
  const scores: Record<string, number> = {
    "Not Yet Started": 0,
    "In Progress, Planning or Initiated": 25,
    "In Progress, Partial": 50,
    "In Progress, Mostly Done or Testing": 75,
    "Complete or Verified": 100,
  };
  return (scores[status] ?? 0) / 100;
}

export function computeProjectPercentComplete(
  tasks: { status: string }[]
): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce(
    (sum, t) => sum + computeTaskPercentDone(t.status),
    0
  );
  return total / tasks.length;
}

export function computeProjectDerivedStatus(
  tasks: { status: string }[]
): "In Progress" | "Completed" {
  if (tasks.length === 0) return "In Progress";
  return tasks.every((t) => t.status === "Complete or Verified")
    ? "Completed"
    : "In Progress";
}
