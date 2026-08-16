import { prisma } from "./db";
import { revalidateTag } from "next/cache";
import { PORTFOLIO_CACHE_TAG } from "./portfolio-data";
import {
  getDefaultSettings,
  type ComputationSettings,
} from "./computation-settings";

const SETTINGS_KEY = "computationSettings";

export async function getSettings(): Promise<ComputationSettings> {
  const row = await prisma.systemMetadata.findUnique({
    where: { key: SETTINGS_KEY },
  });
  if (!row) return getDefaultSettings();
  try {
    const parsed = JSON.parse(row.value);
    if (
      Array.isArray(parsed.statuses) &&
      parsed.statuses.length === 5 &&
      Array.isArray(parsed.healthRules) &&
      parsed.healthRules.length === 5
    ) {
      return parsed as ComputationSettings;
    }
    return getDefaultSettings();
  } catch {
    return getDefaultSettings();
  }
}

export async function saveSettings(
  settings: ComputationSettings
): Promise<void> {
  await prisma.systemMetadata.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(settings) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(settings) },
  });
  revalidateTag(PORTFOLIO_CACHE_TAG, { expire: 0 });
}

export async function migrateStatuses(
  oldSettings: ComputationSettings,
  newSettings: ComputationSettings
): Promise<Record<string, number>> {
  const migrated: Record<string, number> = {};

  for (let i = 0; i < oldSettings.statuses.length; i++) {
    const oldS = oldSettings.statuses[i];
    const newS = newSettings.statuses[i];
    if (oldS.name !== newS.name) {
      const result = await prisma.task.updateMany({
        where: { status: oldS.name },
        data: { status: newS.name },
      });
      migrated[`${oldS.name} → ${newS.name}`] = result.count;
    }
  }

  return migrated;
}
