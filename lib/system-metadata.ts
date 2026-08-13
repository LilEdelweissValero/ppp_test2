import { prisma } from "./db";
import { revalidateTag } from "next/cache";
import { PORTFOLIO_CACHE_TAG } from "./portfolio-data";

const LAST_MODIFIED_KEY = "lastModifiedAt";

export async function touchLastModified(): Promise<void> {
  const now = new Date().toISOString();
  await prisma.systemMetadata.upsert({
    where: { key: LAST_MODIFIED_KEY },
    update: { value: now },
    create: { key: LAST_MODIFIED_KEY, value: now },
  });
  revalidateTag(PORTFOLIO_CACHE_TAG, { expire: 0 });
}

export async function getLastModifiedAt(): Promise<string | null> {
  const row = await prisma.systemMetadata.findUnique({
    where: { key: LAST_MODIFIED_KEY },
  });
  return row?.value ?? null;
}
