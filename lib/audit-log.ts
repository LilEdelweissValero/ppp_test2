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

  const lastLog = await prisma.entityChangeLog.findFirst({
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  const nextSeq = (lastLog?.seq ?? 0) + 1;

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
      seq: nextSeq,
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
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push(`${field}: "${oldVal ?? ""}" → "${newVal ?? ""}"`);
    }
  }
  return changes.length > 0 ? changes.join("; ") : null;
}
