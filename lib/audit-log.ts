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

export function diffFields(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): string | null {
  const changes: string[] = [];
  for (const field of fields) {
    if (!(field in newObj)) continue;
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push(`${field}: "${oldVal ?? ""}" → "${newVal ?? ""}"`);
    }
  }
  return changes.length > 0 ? changes.join("; ") : null;
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
