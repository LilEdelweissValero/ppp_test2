import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  const simple = request.nextUrl.searchParams.get("simple") === "true";

  const programs = await prisma.program.findMany({
    include: simple
      ? { framework: { select: { name: true } } }
      : {
          projects: {
            include: { tasks: true },
            orderBy: { sortOrder: "asc" },
          },
          framework: { select: { name: true } },
        },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(programs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, frameworkId } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!frameworkId) {
    return NextResponse.json({ error: "Framework is required" }, { status: 400 });
  }
  const existing = await prisma.program.findFirst({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Program name already exists" }, { status: 409 });
  }
  const framework = await prisma.framework.findUnique({ where: { id: parseInt(frameworkId) } });
  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }
  const maxOrder = await prisma.program.aggregate({
    _max: { sortOrder: true },
    where: { frameworkId: parseInt(frameworkId) },
  });
  const program = await prisma.program.create({
    data: {
      name: name.trim(),
      frameworkId: parseInt(frameworkId),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  await touchLastModified();
  await logChange({
    entityType: "Program",
    entityId: program.id,
    entityName: program.name,
    changeType: "create",
    newValue: program.name,
  });
  return NextResponse.json(program, { status: 201 });
}
