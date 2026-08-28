import { prisma } from "@/lib/db";

export interface AbandonedData {
  programs: Array<{
    id: number;
    name: string;
    abandonedAt: string | null;
    abandonedReason: string | null;
    abandonedRemarks: string | null;
    framework: { id: number; name: string };
    projects: Array<{
      id: number;
      name: string;
      abandonedAt: string | null;
      abandonedReason: string | null;
      abandonedRemarks: string | null;
      tasks: Array<{
        id: number;
        taskCode: string;
        name: string;
        assignee: string | null;
        status: string;
        abandonedAt: string | null;
        abandonedReason: string | null;
        abandonedRemarks: string | null;
      }>;
      specialTasks: Array<{
        id: number;
        specialTaskCode: string;
        name: string;
        abandonedAt: string | null;
        abandonedReason: string | null;
        abandonedRemarks: string | null;
      }>;
    }>;
  }>;
  projects: Array<{
    id: number;
    name: string;
    abandonedAt: string | null;
    abandonedReason: string | null;
    abandonedRemarks: string | null;
    program: { id: number; name: string };
    tasks: Array<{
      id: number;
      taskCode: string;
      name: string;
      assignee: string | null;
      status: string;
      abandonedAt: string | null;
      abandonedReason: string | null;
      abandonedRemarks: string | null;
    }>;
    specialTasks: Array<{
      id: number;
      specialTaskCode: string;
      name: string;
      abandonedAt: string | null;
      abandonedReason: string | null;
      abandonedRemarks: string | null;
    }>;
  }>;
  tasks: Array<{
    id: number;
    taskCode: string;
    name: string;
    assignee: string | null;
    status: string;
    abandonedAt: string | null;
    abandonedReason: string | null;
    abandonedRemarks: string | null;
    project: {
      id: number;
      name: string;
      program: {
        id: number;
        name: string;
        framework: { id: number; name: string };
      };
    };
  }>;
  specialTasks: Array<{
    id: number;
    specialTaskCode: string;
    name: string;
    abandonedAt: string | null;
    abandonedReason: string | null;
    abandonedRemarks: string | null;
    project: {
      id: number;
      name: string;
      program: {
        id: number;
        name: string;
        framework: { id: number; name: string };
      };
    };
  }>;
}

export async function fetchAbandonedData(): Promise<AbandonedData> {
  const [abandonedPrograms, abandonedProjects, abandonedTasks, abandonedSpecialTasks] = await Promise.all([
    prisma.program.findMany({
      where: { abandoned: true },
      select: {
        id: true,
        name: true,
        abandonedAt: true,
        abandonedReason: true,
        abandonedRemarks: true,
        framework: { select: { id: true, name: true } },
        projects: {
          where: { abandoned: true },
          select: {
            id: true,
            name: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
            tasks: {
              where: { abandoned: true },
              select: {
                id: true,
                taskCode: true,
                name: true,
                assignee: true,
                status: true,
                abandonedAt: true,
                abandonedReason: true,
                abandonedRemarks: true,
              },
              orderBy: { sortOrder: "asc" },
            },
            specialTasks: {
              where: { abandoned: true },
              select: {
                id: true,
                specialTaskCode: true,
                name: true,
                abandonedAt: true,
                abandonedReason: true,
                abandonedRemarks: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.project.findMany({
      where: {
        abandoned: true,
        program: { abandoned: false },
      },
      select: {
        id: true,
        name: true,
        abandonedAt: true,
        abandonedReason: true,
        abandonedRemarks: true,
        program: { select: { id: true, name: true } },
        tasks: {
          where: { abandoned: true },
          select: {
            id: true,
            taskCode: true,
            name: true,
            assignee: true,
            status: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        specialTasks: {
          where: { abandoned: true },
          select: {
            id: true,
            specialTaskCode: true,
            name: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.task.findMany({
      where: {
        abandoned: true,
        project: { abandoned: false },
      },
      select: {
        id: true,
        taskCode: true,
        name: true,
        assignee: true,
        status: true,
        abandonedAt: true,
        abandonedReason: true,
        abandonedRemarks: true,
        project: {
          select: {
            id: true,
            name: true,
            program: { select: { id: true, name: true, framework: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.specialTask.findMany({
      where: {
        abandoned: true,
        project: { abandoned: false },
      },
      select: {
        id: true,
        specialTaskCode: true,
        name: true,
        abandonedAt: true,
        abandonedReason: true,
        abandonedRemarks: true,
        project: {
          select: {
            id: true,
            name: true,
            program: { select: { id: true, name: true, framework: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return {
    programs: abandonedPrograms,
    projects: abandonedProjects,
    tasks: abandonedTasks,
    specialTasks: abandonedSpecialTasks,
  };
}
