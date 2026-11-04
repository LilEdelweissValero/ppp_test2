import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const PORTFOLIO_CACHE_TAG = "portfolio";

export const getDashboardData = unstable_cache(
  async () => {
    const [rawFrameworks, lastModified, carried] = await Promise.all([
      prisma.framework.findMany({
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
                  phasesTableName: true,
                  // How many carried-over tasks this project has (hidden from
                  // the dashboard); lets the dashboard skip the stale client cache.
                  _count: {
                    select: {
                      tasks: { where: { abandoned: false, carriedOverTo: { not: null } } },
                      specialTasks: { where: { abandoned: false, carriedOverTo: { not: null } } },
                      suchTasks: { where: { abandoned: false, carriedOverTo: { not: null } } },
                    },
                  },
                  phases: {
                    select: {
                      id: true,
                      name: true,
                      weight: true,
                      sortOrder: true,
                    },
                    orderBy: { sortOrder: "asc" },
                  },
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
                      phaseId: true,
                    },
                    where: { abandoned: false, carriedOverTo: null },
                    orderBy: { sortOrder: "asc" },
                  },
                  specialTasks: {
                    select: {
                      id: true,
                      specialTaskCode: true,
                      name: true,
                      sortOrder: true,
                      total: true,
                      nys: true,
                      plan: true,
                      part: true,
                      mostly: true,
                      done: true,
                      dueQuarter: true,
                      lastUpdatedDate: true,
                      phaseId: true,
                    },
                    where: { abandoned: false, carriedOverTo: null },
                    orderBy: { sortOrder: "asc" },
                  },
                  suchTasks: {
                    select: {
                      id: true,
                      suchTaskCode: true,
                      name: true,
                      sortOrder: true,
                      totalScheduled: true,
                      sv: true,
                      snv: true,
                      nsv: true,
                      dueQuarter: true,
                      lastUpdatedDate: true,
                      phaseId: true,
                    },
                    where: { abandoned: false, carriedOverTo: null },
                    orderBy: { sortOrder: "asc" },
                  },
                },
                where: { abandoned: false, carriedOverTo: null },
                orderBy: { sortOrder: "asc" },
              },
            },
            where: { abandoned: false },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.systemMetadata.findUnique({
        where: { key: "lastModifiedAt" },
        select: { value: true },
      }),
      // Whole projects that were carried over: shown on the dashboard as amber
      // rows, kept in a separate list so they never enter any aggregate.
      prisma.project.findMany({
        where: { abandoned: false, carriedOverTo: { not: null }, program: { abandoned: false } },
        select: {
          id: true,
          name: true,
          programId: true,
          reference: true,
          owner: true,
          carriedOverTo: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const carriedByProgram = new Map<number, (Omit<(typeof carried)[number], "carriedOverTo"> & { carriedOverTo: string })[]>();
    for (const p of carried) {
      const list = carriedByProgram.get(p.programId) ?? [];
      // The query filters on carriedOverTo not null, so it is always set here
      list.push({ ...p, carriedOverTo: p.carriedOverTo as string });
      carriedByProgram.set(p.programId, list);
    }

    const frameworks = rawFrameworks.map((f) => ({
      ...f,
      programs: f.programs.map((prog) => ({
        ...prog,
        carriedProjects: carriedByProgram.get(prog.id) ?? [],
        projects: prog.projects.map(({ _count, ...project }) => ({
          ...project,
          carriedTaskCount: _count.tasks + _count.specialTasks + _count.suchTasks,
        })),
      })),
    }));

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
        phasesTableName: true,
        carriedOverTo: true,
        carriedOverRemarks: true,
        program: { select: { id: true, name: true } },
        phases: {
          select: {
            id: true,
            name: true,
            weight: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
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
            phaseId: true,
            carriedOverTo: true,
            carriedOverRemarks: true,
          },
          // Carried-over rows stay in so the project page can show them amber;
          // callers exclude them from every calculation.
          where: { abandoned: false },
          orderBy: { sortOrder: "asc" },
        },
        specialTasks: {
          select: {
            id: true,
            specialTaskCode: true,
            name: true,
            sortOrder: true,
            total: true,
            nys: true,
            plan: true,
            part: true,
            mostly: true,
            done: true,
            dueQuarter: true,
            lastUpdatedDate: true,
            phaseId: true,
            carriedOverTo: true,
            carriedOverRemarks: true,
          },
          where: { abandoned: false },
          orderBy: { sortOrder: "asc" },
        },
        suchTasks: {
          select: {
            id: true,
            suchTaskCode: true,
            name: true,
            sortOrder: true,
            totalScheduled: true,
            sv: true,
            snv: true,
            nsv: true,
            dueQuarter: true,
            lastUpdatedDate: true,
            phaseId: true,
            carriedOverTo: true,
            carriedOverRemarks: true,
          },
          where: { abandoned: false },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
  ["project-data"],
  { tags: [PORTFOLIO_CACHE_TAG], revalidate: 60 }
);
