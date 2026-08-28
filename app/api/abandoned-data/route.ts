import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // Fetch all abandoned programs with their children
  const abandonedPrograms = await prisma.program.findMany({
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
  });

  // Fetch abandoned projects NOT under an abandoned program
  const abandonedProjects = await prisma.project.findMany({
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
  });

  // Fetch abandoned tasks NOT under an abandoned project or program
  const abandonedTasks = await prisma.task.findMany({
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
  });

  // Fetch abandoned special tasks NOT under an abandoned project
  const abandonedSpecialTasks = await prisma.specialTask.findMany({
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
  });

  return NextResponse.json({
    programs: abandonedPrograms,
    projects: abandonedProjects,
    tasks: abandonedTasks,
    specialTasks: abandonedSpecialTasks,
  });
}
