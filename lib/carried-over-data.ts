import { prisma } from "@/lib/db";

export type CarriedItemType = "task" | "special-task" | "such-task";

export interface CarriedItem {
  key: string; // `${type}:${id}`
  type: CarriedItemType;
  id: number;
  code: string;
  name: string;
  projectId: number;
  projectName: string;
  programName: string;
  projectParked: boolean; // the whole project was carried over
  originalQuarter: string;
  carriedOverTo: string;
  carriedOverAt: string | null;
  carriedOverRemarks: string | null;
}

export interface PullTargetProject {
  id: number;
  name: string;
  programName: string;
  targetQuarter: string;
}

export interface CarriedOverData {
  items: CarriedItem[];
  years: string[];
  targetProjects: PullTargetProject[];
}

export async function fetchCarriedOverData(): Promise<CarriedOverData> {
  const where = { carriedOverTo: { not: null }, abandoned: false };
  const projectSelect = {
    select: {
      id: true,
      name: true,
      carriedOverTo: true,
      program: { select: { name: true } },
    },
  } as const;

  const [tasks, specialTasks, suchTasks, targetProjects] = await Promise.all([
    prisma.task.findMany({ where, include: { project: projectSelect }, orderBy: { id: "asc" } }),
    prisma.specialTask.findMany({ where, include: { project: projectSelect }, orderBy: { id: "asc" } }),
    prisma.suchTask.findMany({ where, include: { project: projectSelect }, orderBy: { id: "asc" } }),
    prisma.project.findMany({
      where: { abandoned: false, carriedOverTo: null },
      select: { id: true, name: true, targetQuarter: true, program: { select: { name: true } } },
      orderBy: [{ programId: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  const items: CarriedItem[] = [
    ...tasks.map((t) => ({
      key: `task:${t.id}`,
      type: "task" as const,
      id: t.id,
      code: t.taskCode,
      name: t.name,
      projectId: t.project.id,
      projectName: t.project.name,
      programName: t.project.program.name,
      projectParked: t.project.carriedOverTo !== null,
      originalQuarter: t.adjustedTargetQuarter,
      carriedOverTo: t.carriedOverTo as string,
      carriedOverAt: t.carriedOverAt,
      carriedOverRemarks: t.carriedOverRemarks,
    })),
    ...specialTasks.map((t) => ({
      key: `special-task:${t.id}`,
      type: "special-task" as const,
      id: t.id,
      code: t.specialTaskCode,
      name: t.name,
      projectId: t.project.id,
      projectName: t.project.name,
      programName: t.project.program.name,
      projectParked: t.project.carriedOverTo !== null,
      originalQuarter: t.dueQuarter,
      carriedOverTo: t.carriedOverTo as string,
      carriedOverAt: t.carriedOverAt,
      carriedOverRemarks: t.carriedOverRemarks,
    })),
    ...suchTasks.map((t) => ({
      key: `such-task:${t.id}`,
      type: "such-task" as const,
      id: t.id,
      code: t.suchTaskCode,
      name: t.name,
      projectId: t.project.id,
      projectName: t.project.name,
      programName: t.project.program.name,
      projectParked: t.project.carriedOverTo !== null,
      originalQuarter: t.dueQuarter,
      carriedOverTo: t.carriedOverTo as string,
      carriedOverAt: t.carriedOverAt,
      carriedOverRemarks: t.carriedOverRemarks,
    })),
  ];

  const years = [...new Set(items.map((i) => i.carriedOverTo))].sort();

  return {
    items,
    years,
    targetProjects: targetProjects.map((p) => ({
      id: p.id,
      name: p.name,
      programName: p.program.name,
      targetQuarter: p.targetQuarter,
    })),
  };
}
