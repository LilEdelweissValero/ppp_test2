import { prisma } from "@/lib/db";

export interface AbandonedData {
  programs: Array<{
    id: number;
    name: string;
    abandoned: boolean;
    abandonedAt: string | null;
    abandonedReason: string | null;
    abandonedRemarks: string | null;
    framework: { id: number; name: string };
    projects: Array<{
      id: number;
      name: string;
      abandoned: boolean;
      abandonedAt: string | null;
      abandonedReason: string | null;
      abandonedRemarks: string | null;
      tasks: Array<{
        id: number;
        type: "task" | "special-task";
        code: string;
        name: string;
        abandonedAt: string | null;
        abandonedReason: string | null;
        abandonedRemarks: string | null;
      }>;
    }>;
  }>;
}

interface ProgramEntry {
  id: number;
  name: string;
  abandoned: boolean;
  abandonedAt: string | null;
  abandonedReason: string | null;
  abandonedRemarks: string | null;
  framework: { id: number; name: string };
  projects: Map<number, ProjectEntry>;
  sortOrder?: number;
}

interface ProjectEntry {
  id: number;
  name: string;
  abandoned: boolean;
  abandonedAt: string | null;
  abandonedReason: string | null;
  abandonedRemarks: string | null;
  tasks: Array<{
    id: number;
    type: "task" | "special-task";
    code: string;
    name: string;
    abandonedAt: string | null;
    abandonedReason: string | null;
    abandonedRemarks: string | null;
  }>;
  sortOrder?: number;
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
        sortOrder: true,
        framework: { select: { id: true, name: true } },
        projects: {
          where: { abandoned: true },
          select: {
            id: true,
            name: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
            sortOrder: true,
            tasks: {
              where: { abandoned: true },
              select: {
                id: true,
                taskCode: true,
                name: true,
                abandonedAt: true,
                abandonedReason: true,
                abandonedRemarks: true,
                sortOrder: true,
              },
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
                sortOrder: true,
              },
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
        sortOrder: true,
        program: {
          select: {
            id: true,
            name: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
            sortOrder: true,
            framework: { select: { id: true, name: true } },
          },
        },
        tasks: {
          where: { abandoned: true },
          select: {
            id: true,
            taskCode: true,
            name: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
            sortOrder: true,
          },
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
            sortOrder: true,
          },
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
        abandonedAt: true,
        abandonedReason: true,
        abandonedRemarks: true,
        sortOrder: true,
        project: {
          select: {
            id: true,
            name: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
            sortOrder: true,
            program: {
              select: {
                id: true,
                name: true,
                abandonedAt: true,
                abandonedReason: true,
                abandonedRemarks: true,
                sortOrder: true,
                framework: { select: { id: true, name: true } },
              },
            },
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
        sortOrder: true,
        project: {
          select: {
            id: true,
            name: true,
            abandonedAt: true,
            abandonedReason: true,
            abandonedRemarks: true,
            sortOrder: true,
            program: {
              select: {
                id: true,
                name: true,
                abandonedAt: true,
                abandonedReason: true,
                abandonedRemarks: true,
                sortOrder: true,
                framework: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const programMap = new Map<number, ProgramEntry>();

  for (const prog of abandonedPrograms) {
    programMap.set(prog.id, {
      id: prog.id,
      name: prog.name,
      abandoned: true,
      abandonedAt: prog.abandonedAt,
      abandonedReason: prog.abandonedReason,
      abandonedRemarks: prog.abandonedRemarks,
      framework: prog.framework,
      projects: new Map(),
      sortOrder: prog.sortOrder,
    });
    for (const proj of prog.projects) {
      const tasks = [
        ...proj.tasks.map((t) => ({
          id: t.id,
          type: "task" as const,
          code: t.taskCode,
          name: t.name,
          abandonedAt: t.abandonedAt,
          abandonedReason: t.abandonedReason,
          abandonedRemarks: t.abandonedRemarks,
        })),
        ...proj.specialTasks.map((st) => ({
          id: st.id,
          type: "special-task" as const,
          code: st.specialTaskCode,
          name: st.name,
          abandonedAt: st.abandonedAt,
          abandonedReason: st.abandonedReason,
          abandonedRemarks: st.abandonedRemarks,
        })),
      ].sort((a, b) => (a.code > b.code ? 1 : a.code < b.code ? -1 : 0));

      prog.projects.set(proj.id, {
        id: proj.id,
        name: proj.name,
        abandoned: true,
        abandonedAt: proj.abandonedAt,
        abandonedReason: proj.abandonedReason,
        abandonedRemarks: proj.abandonedRemarks,
        tasks,
        sortOrder: proj.sortOrder,
      });
    }
  }

  for (const proj of abandonedProjects) {
    let program = programMap.get(proj.program.id);
    if (!program) {
      program = {
        id: proj.program.id,
        name: proj.program.name,
        abandoned: false,
        abandonedAt: proj.program.abandonedAt,
        abandonedReason: proj.program.abandonedReason,
        abandonedRemarks: proj.program.abandonedRemarks,
        framework: proj.program.framework,
        projects: new Map(),
        sortOrder: proj.program.sortOrder,
      };
      programMap.set(proj.program.id, program);
    }

    const tasks = [
      ...proj.tasks.map((t) => ({
        id: t.id,
        type: "task" as const,
        code: t.taskCode,
        name: t.name,
        abandonedAt: t.abandonedAt,
        abandonedReason: t.abandonedReason,
        abandonedRemarks: t.abandonedRemarks,
      })),
      ...proj.specialTasks.map((st) => ({
        id: st.id,
        type: "special-task" as const,
        code: st.specialTaskCode,
        name: st.name,
        abandonedAt: st.abandonedAt,
        abandonedReason: st.abandonedReason,
        abandonedRemarks: st.abandonedRemarks,
      })),
    ].sort((a, b) => (a.code > b.code ? 1 : a.code < b.code ? -1 : 0));

    program.projects.set(proj.id, {
      id: proj.id,
      name: proj.name,
      abandoned: true,
      abandonedAt: proj.abandonedAt,
      abandonedReason: proj.abandonedReason,
      abandonedRemarks: proj.abandonedRemarks,
      tasks,
      sortOrder: proj.sortOrder,
    });
  }

  for (const task of abandonedTasks) {
    let program = programMap.get(task.project.program.id);
    if (!program) {
      program = {
        id: task.project.program.id,
        name: task.project.program.name,
        abandoned: false,
        abandonedAt: task.project.program.abandonedAt,
        abandonedReason: task.project.program.abandonedReason,
        abandonedRemarks: task.project.program.abandonedRemarks,
        framework: task.project.program.framework,
        projects: new Map(),
        sortOrder: task.project.program.sortOrder,
      };
      programMap.set(task.project.program.id, program);
    }

    let project = program.projects.get(task.project.id);
    if (!project) {
      project = {
        id: task.project.id,
        name: task.project.name,
        abandoned: false,
        abandonedAt: task.project.abandonedAt,
        abandonedReason: task.project.abandonedReason,
        abandonedRemarks: task.project.abandonedRemarks,
        tasks: [],
        sortOrder: task.project.sortOrder,
      };
      program.projects.set(task.project.id, project);
    }

    project.tasks.push({
      id: task.id,
      type: "task",
      code: task.taskCode,
      name: task.name,
      abandonedAt: task.abandonedAt,
      abandonedReason: task.abandonedReason,
      abandonedRemarks: task.abandonedRemarks,
    });
  }

  for (const st of abandonedSpecialTasks) {
    let program = programMap.get(st.project.program.id);
    if (!program) {
      program = {
        id: st.project.program.id,
        name: st.project.program.name,
        abandoned: false,
        abandonedAt: st.project.program.abandonedAt,
        abandonedReason: st.project.program.abandonedReason,
        abandonedRemarks: st.project.program.abandonedRemarks,
        framework: st.project.program.framework,
        projects: new Map(),
        sortOrder: st.project.program.sortOrder,
      };
      programMap.set(st.project.program.id, program);
    }

    let project = program.projects.get(st.project.id);
    if (!project) {
      project = {
        id: st.project.id,
        name: st.project.name,
        abandoned: false,
        abandonedAt: st.project.abandonedAt,
        abandonedReason: st.project.abandonedReason,
        abandonedRemarks: st.project.abandonedRemarks,
        tasks: [],
        sortOrder: st.project.sortOrder,
      };
      program.projects.set(st.project.id, project);
    }

    project.tasks.push({
      id: st.id,
      type: "special-task",
      code: st.specialTaskCode,
      name: st.name,
      abandonedAt: st.abandonedAt,
      abandonedReason: st.abandonedReason,
      abandonedRemarks: st.abandonedRemarks,
    });
  }

  const programs = Array.from(programMap.values())
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((p) => ({
      ...p,
      sortOrder: undefined,
      projects: Array.from(p.projects.values())
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((proj) => ({
          ...proj,
          sortOrder: undefined,
          tasks: proj.tasks.sort((a, b) => (a.code > b.code ? 1 : a.code < b.code ? -1 : 0)),
        })),
    }));

  return { programs };
}
