import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const PORTFOLIO_CACHE_TAG = "portfolio";

export const getDashboardData = unstable_cache(
  async () => {
    const [frameworks, lastModified] = await Promise.all([
      prisma.framework.findMany({
        where: { archived: false },
        select: {
          id: true,
          name: true,
          color: true,
          programs: {
            select: {
              id: true,
              name: true,
              frameworkId: true,
              projects: {
                select: {
                  id: true,
                  name: true,
                  programId: true,
                  reference: true,
                  owner: true,
                  targetQuarter: true,
                  adjustedTargetQuarter: true,
                  actualCompletionDate: true,
                  tasks: {
                    select: {
                      id: true,
                      taskCode: true,
                      name: true,
                      assignee: true,
                      priority: true,
                      status: true,
                      description: true,
                      targetQuarter: true,
                      notes: true,
                      deliverable: true,
                      attachments: true,
                      dependencies: true,
                      adjustedTargetQuarter: true,
                    },
                    where: { archived: false },
                    orderBy: { sortOrder: "asc" },
                  },
                },
                where: { archived: false },
                orderBy: { sortOrder: "asc" },
              },
            },
            where: { archived: false },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.systemMetadata.findUnique({
        where: { key: "lastModifiedAt" },
        select: { value: true },
      }),
    ]);

    return { frameworks, lastModifiedAt: lastModified?.value ?? null };
  },
  ["dashboard-data"],
  { tags: [PORTFOLIO_CACHE_TAG], revalidate: 60 }
);

export const getProjectData = unstable_cache(
  async (id: number) =>
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        programId: true,
        reference: true,
        owner: true,
        targetQuarter: true,
        adjustedTargetQuarter: true,
        actualCompletionDate: true,
        program: { select: { id: true, name: true } },
        tasks: {
          select: {
            id: true,
            taskCode: true,
            name: true,
            assignee: true,
            priority: true,
            status: true,
            description: true,
            targetQuarter: true,
            adjustedTargetQuarter: true,
            deliverable: true,
            attachments: true,
            dependencies: true,
            notes: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
  ["project-data"],
  { tags: [PORTFOLIO_CACHE_TAG], revalidate: 60 }
);

export async function getArchivedData() {
  return prisma.framework.findMany({
    where: { archived: true },
    select: {
      id: true,
      name: true,
      color: true,
      programs: {
        select: {
          id: true,
          name: true,
          frameworkId: true,
          projects: {
            select: {
              id: true,
              name: true,
              programId: true,
              reference: true,
              owner: true,
              targetQuarter: true,
              adjustedTargetQuarter: true,
              actualCompletionDate: true,
              tasks: {
                select: {
                  id: true,
                  taskCode: true,
                  name: true,
                  assignee: true,
                  priority: true,
                  status: true,
                  description: true,
                  targetQuarter: true,
                  adjustedTargetQuarter: true,
                  deliverable: true,
                  attachments: true,
                  dependencies: true,
                  notes: true,
                },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}
