import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [tasks, specialTasks] = await Promise.all([
    prisma.task.count(),
    prisma.specialTask.count(),
  ]);

  return NextResponse.json({ tasks, specialTasks });
}
