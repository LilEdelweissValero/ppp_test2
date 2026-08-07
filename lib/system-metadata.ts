import { prisma } from "./db";

const LAST_MODIFIED_KEY = "lastModifiedAt";

export async function touchLastModified(): Promise<void> {
  await prisma.systemMetadata.upsert({
    where: { key: LAST_MODIFIED_KEY },
    update: { value: new Date().toISOString() },
    create: { key: LAST_MODIFIED_KEY, value: new Date().toISOString() },
  });
}

export async function getLastModifiedAt(): Promise<string | null> {
  const row = await prisma.systemMetadata.findUnique({
    where: { key: LAST_MODIFIED_KEY },
  });
  return row?.value ?? null;
}
