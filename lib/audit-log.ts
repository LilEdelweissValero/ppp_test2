import { prisma } from "@/lib/db";

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
