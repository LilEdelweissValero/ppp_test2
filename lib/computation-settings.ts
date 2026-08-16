import { currentQuarter, compareQuarters } from "./quarters";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ComputationStatus {
  id: string;
  name: string;
  score: number;
}

export interface HealthRule {
  quarterConditions: string[];
  quarterOperator: "AND" | "OR";
  percentConditions: string[];
  percentOperator: "AND" | "OR";
  healthStatus: string;
}

export interface ComputationSettings {
  statuses: ComputationStatus[];
  healthRules: HealthRule[];
}

// ── Constants ──────────────────────────────────────────────────────────────

export const QUARTER_CONDITIONS: Record<string, string> = {
  regardless: "Regardless of due Q",
  future: "Due in the future",
  now: "Due now",
  past: "Due in the past",
};

export const PERCENT_CONDITIONS: Record<string, string> = {
  any: "Regardless of %",
  eq100: "Equal to 100%",
  gte75: "≥ 75% done",
  gte50: "≥ 50% done",
  lt50: "< 50% done",
};

export const DEFAULT_STATUSES: ComputationStatus[] = [
  { id: "nys", name: "Not Yet Started", score: 0 },
  { id: "plan", name: "In Progress, Planning or Initiated", score: 25 },
  { id: "part", name: "In Progress, Partial", score: 50 },
  { id: "most", name: "In Progress, Mostly Done or Testing", score: 75 },
  { id: "done", name: "Complete or Verified", score: 100 },
];

export const DEFAULT_HEALTH_RULES: HealthRule[] = [
  {
    quarterConditions: ["regardless"],
    quarterOperator: "OR",
    percentConditions: ["eq100"],
    percentOperator: "OR",
    healthStatus: "Completed",
  },
  {
    quarterConditions: ["future"],
    quarterOperator: "OR",
    percentConditions: ["any"],
    percentOperator: "OR",
    healthStatus: "Not Yet Due",
  },
  {
    quarterConditions: ["now", "past"],
    quarterOperator: "OR",
    percentConditions: ["gte75"],
    percentOperator: "OR",
    healthStatus: "On Time",
  },
  {
    quarterConditions: ["now", "past"],
    quarterOperator: "OR",
    percentConditions: ["gte50"],
    percentOperator: "OR",
    healthStatus: "At Risk",
  },
  {
    quarterConditions: ["now", "past"],
    quarterOperator: "OR",
    percentConditions: ["lt50"],
    percentOperator: "OR",
    healthStatus: "Delayed",
  },
];

// ── Defaults ───────────────────────────────────────────────────────────────

export function getDefaultSettings(): ComputationSettings {
  return {
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    healthRules: DEFAULT_HEALTH_RULES.map((r) => ({ ...r })),
  };
}

// ── Health Rule Evaluation ─────────────────────────────────────────────────

function matchQuarterCondition(
  condition: string,
  quarterState: "future" | "now" | "past"
): boolean {
  if (condition === "regardless") return true;
  return condition === quarterState;
}

function matchPercentCondition(
  condition: string,
  percentComplete: number
): boolean {
  switch (condition) {
    case "any":
      return true;
    case "eq100":
      return percentComplete === 100;
    case "gte75":
      return percentComplete >= 75;
    case "gte50":
      return percentComplete >= 50;
    case "lt50":
      return percentComplete < 50;
    default:
      return false;
  }
}

function evaluateConditions(
  conditions: string[],
  operator: "AND" | "OR",
  matcher: (c: string) => boolean
): boolean {
  if (conditions.length === 0) return true;
  if (operator === "AND") return conditions.every(matcher);
  return conditions.some(matcher);
}

export function computeHealthFromRules(
  rules: HealthRule[],
  percentComplete: number,
  adjustedTargetQuarter: string
): string {
  const cq = compareQuarters(adjustedTargetQuarter, currentQuarter());
  const quarterState: "future" | "now" | "past" =
    cq > 0 ? "future" : cq === 0 ? "now" : "past";

  for (const rule of rules) {
    const qMatch = evaluateConditions(
      rule.quarterConditions,
      rule.quarterOperator,
      (c) => matchQuarterCondition(c, quarterState)
    );
    const pMatch = evaluateConditions(
      rule.percentConditions,
      rule.percentOperator,
      (c) => matchPercentCondition(c, percentComplete)
    );
    if (qMatch && pMatch) return rule.healthStatus;
  }

  return "Delayed";
}

// ── Health Rule Validation ─────────────────────────────────────────────────

export function validateHealthRules(
  rules: HealthRule[]
): { valid: boolean; gaps: string[] } {
  const quarterStates: Array<"future" | "now" | "past"> = ["future", "now", "past"];
  const percentRanges: Array<{ key: string; label: string }> = [
    { key: "100", label: "100%" },
    { key: "75-99", label: "75–99%" },
    { key: "50-74", label: "50–74%" },
    { key: "0-49", label: "0–49%" },
  ];

  const gaps: string[] = [];

  for (const qs of quarterStates) {
    for (const pr of percentRanges) {
      let matched = false;
      for (const rule of rules) {
        const qMatch = evaluateConditions(
          rule.quarterConditions,
          rule.quarterOperator,
          (c) => matchQuarterCondition(c, qs)
        );
        const pMatch = evaluateConditions(
          rule.percentConditions,
          rule.percentOperator,
          (c) => {
            switch (c) {
              case "any":
                return true;
              case "eq100":
                return pr.key === "100";
              case "gte75":
                return pr.key === "100" || pr.key === "75-99";
              case "gte50":
                return (
                  pr.key === "100" ||
                  pr.key === "75-99" ||
                  pr.key === "50-74"
                );
              case "lt50":
                return pr.key === "0-49";
              default:
                return false;
            }
          }
        );
        if (qMatch && pMatch) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        const qLabel =
          qs === "future"
            ? "Due in the future"
            : qs === "now"
            ? "Due now"
            : "Due in the past";
        gaps.push(`${qLabel} + ${pr.label}`);
      }
    }
  }

  return { valid: gaps.length === 0, gaps };
}

// ── Meaning Auto-Generation ────────────────────────────────────────────────

export function generateMeaning(rule: HealthRule): string {
  const qParts = rule.quarterConditions.map(
    (c) => QUARTER_CONDITIONS[c] || c
  );
  const pParts = rule.percentConditions.map(
    (c) => PERCENT_CONDITIONS[c] || c
  );

  let quarterText: string;
  if (
    rule.quarterConditions.length === 1 &&
    rule.quarterConditions[0] === "regardless"
  ) {
    quarterText = "Regardless of schedule";
  } else if (rule.quarterConditions.length === 1) {
    quarterText = qParts[0];
  } else {
    quarterText = qParts.join(` ${rule.quarterOperator} `);
  }

  let percentText: string;
  if (
    rule.percentConditions.length === 1 &&
    rule.percentConditions[0] === "any"
  ) {
    percentText = "progress not evaluated";
  } else if (rule.percentConditions.length === 1) {
    percentText = pParts[0];
  } else {
    percentText = pParts.join(` ${rule.percentOperator} `);
  }

  const needsAnd =
    !(
      rule.quarterConditions.length === 1 &&
      rule.quarterConditions[0] === "regardless"
    ) &&
    !(
      rule.percentConditions.length === 1 &&
      rule.percentConditions[0] === "any"
    );

  if (needsAnd) {
    return `${quarterText} and ${percentText.charAt(0).toLowerCase()}${percentText.slice(1)}`;
  }
  return quarterText !== "Regardless of schedule"
    ? quarterText
    : `Progress: ${percentText}`;
}
