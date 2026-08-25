import { prisma } from "@/lib/db";
import type { ComputationSettings } from "@/lib/computation-settings";

interface LogChangeParams {
  entityType: string;
  entityId: number;
  entityName: string;
  changeType: string;
  oldValue?: string | null;
  newValue?: string | null;
  details?: string | null;
  remarks?: string | null;
}

export async function logChange(params: LogChangeParams): Promise<void> {
  const {
    entityType,
    entityId,
    entityName,
    changeType,
    oldValue = null,
    newValue = null,
    details = null,
    remarks = null,
  } = params;

  await prisma.entityChangeLog.create({
    data: {
      entityType,
      entityId,
      entityName,
      changeType,
      oldValue,
      newValue,
      details,
      remarks,
      createdAt: new Date().toISOString(),
      // History is ordered by the autoincrementing primary key. Keep this
      // legacy field populated without scanning the entire log on every save.
      seq: 0,
    },
  });
}

// ── Diff helpers ─────────────────────────────────────────────────────────────

/**
 * Produces a v2 details string: JSON-encoded object of field → {old, new}.
 * This is immune to semicolons/quotes/newlines inside values.
 */
export function diffFieldsV2(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): string | null {
  const changes: Record<string, { old: string; new: string }> = {};
  let hasChanges = false;
  for (const field of fields) {
    if (!(field in newObj)) continue;
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes[field] = { old: String(oldVal ?? ""), new: String(newVal ?? "") };
      hasChanges = true;
    }
  }
  return hasChanges ? JSON.stringify(changes) : null;
}

/**
 * Produces a human-readable details string (legacy format).
 * Kept for backward compatibility with existing log entries.
 */
export function diffFields(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): string | null {
  return diffFieldsV2(oldObj, newObj, fields);
}

/**
 * Robust details parser that handles both v2 (JSON) and legacy formats.
 */
export function parseDetails(details: string): Record<string, { old: string; new: string }> {
  if (!details) return {};

  // Try v2 JSON format first
  const trimmed = details.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        const result: Record<string, { old: string; new: string }> = {};
        for (const [key, val] of Object.entries(parsed)) {
          if (
            typeof val === "object" &&
            val !== null &&
            "old" in val &&
            "new" in val
          ) {
            result[key] = val as { old: string; new: string };
          }
        }
        return result;
      }
    } catch {
      // Fall through to legacy parser
    }
  }

  // Legacy format: `field: "old" → "new"; field2: "old2" → "new2"`
  return parseLegacy(details);
}

function parseLegacy(details: string): Record<string, { old: string; new: string }> {
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

export function diffSettings(
  oldSettings: ComputationSettings,
  newSettings: ComputationSettings
): string | null {
  const changes: string[] = [];

  for (let i = 0; i < oldSettings.statuses.length; i++) {
    const oldS = oldSettings.statuses[i];
    const newS = newSettings.statuses[i];
    if (oldS.name !== newS.name) {
      changes.push(`status[${i}].name: "${oldS.name}" → "${newS.name}"`);
    }
    if (oldS.score !== newS.score) {
      changes.push(`status[${i}].score: ${oldS.score} → ${newS.score}`);
    }
  }

  for (let i = 0; i < oldSettings.healthRules.length; i++) {
    const oldR = oldSettings.healthRules[i];
    const newR = newSettings.healthRules[i];
    if (oldR.healthStatus !== newR.healthStatus) {
      changes.push(`healthRule[${i}].healthStatus: "${oldR.healthStatus}" → "${newR.healthStatus}"`);
    }
    if (JSON.stringify(oldR.quarterConditions) !== JSON.stringify(newR.quarterConditions)) {
      changes.push(`healthRule[${i}].quarterConditions: ${JSON.stringify(oldR.quarterConditions)} → ${JSON.stringify(newR.quarterConditions)}`);
    }
    if (oldR.quarterOperator !== newR.quarterOperator) {
      changes.push(`healthRule[${i}].quarterOperator: "${oldR.quarterOperator}" → "${newR.quarterOperator}"`);
    }
    if (JSON.stringify(oldR.percentConditions) !== JSON.stringify(newR.percentConditions)) {
      changes.push(`healthRule[${i}].percentConditions: ${JSON.stringify(oldR.percentConditions)} → ${JSON.stringify(newR.percentConditions)}`);
    }
    if (oldR.percentOperator !== newR.percentOperator) {
      changes.push(`healthRule[${i}].percentOperator: "${oldR.percentOperator}" → "${newR.percentOperator}"`);
    }
  }

  return changes.length > 0 ? changes.join("; ") : null;
}
