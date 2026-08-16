import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { entityType, entityId } = body;

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }

  let programs = 0;
  let projects = 0;
  let tasks = 0;
  let specialTasks = 0;

  if (entityType === "Framework") {
    const frameworkPrograms = await prisma.program.findMany({
      where: { frameworkId: entityId, archived: false },
      select: { id: true },
    });
    programs = frameworkPrograms.length;
    const programIds = frameworkPrograms.map((p) => p.id);
    if (programIds.length > 0) {
      const frameworkProjects = await prisma.project.findMany({
        where: { programId: { in: programIds }, archived: false },
        select: { id: true },
      });
      projects = frameworkProjects.length;
      const projectIds = frameworkProjects.map((p) => p.id);
      if (projectIds.length > 0) {
        [tasks, specialTasks] = await Promise.all([
          prisma.task.count({
            where: { projectId: { in: projectIds }, archived: false },
          }),
          prisma.specialTask.count({
            where: { projectId: { in: projectIds }, archived: false },
          }),
        ]);
      }
    }
  } else if (entityType === "Program") {
    const programProjects = await prisma.project.findMany({
      where: { programId: entityId, archived: false },
      select: { id: true },
    });
    projects = programProjects.length;
    const projectIds = programProjects.map((p) => p.id);
    if (projectIds.length > 0) {
      [tasks, specialTasks] = await Promise.all([
        prisma.task.count({
          where: { projectId: { in: projectIds }, archived: false },
        }),
        prisma.specialTask.count({
          where: { projectId: { in: projectIds }, archived: false },
        }),
      ]);
    }
  } else if (entityType === "Project") {
    [tasks, specialTasks] = await Promise.all([
      prisma.task.count({
        where: { projectId: entityId, archived: false },
      }),
      prisma.specialTask.count({
        where: { projectId: entityId, archived: false },
      }),
    ]);
  }

  return NextResponse.json({ programs, projects, tasks, specialTasks });
}
