import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

const PRESET_COLORS = [
  "#DBEAFE",
  "#FEE2E2",
  "#D1FAE5",
  "#FEF3C7",
  "#EDE9FE",
  "#FCE7F3",
  "#CCFBF1",
  "#E5E7EB",
];

export async function GET(request: NextRequest) {
  const simple = request.nextUrl.searchParams.get("simple") === "true";
  const options = request.nextUrl.searchParams.get("options") === "true";

  const frameworks = await prisma.framework.findMany({
    ...(options
      ? {
          select: {
            id: true,
            name: true,
            color: true,
            programs: {
              select: { id: true, name: true },
              orderBy: { sortOrder: "asc" as const },
            },
          },
        }
      : simple
      ? {}
      : {
          include: {
            programs: {
              include: {
                projects: {
                  include: { tasks: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        }),
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(frameworks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, color } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!color || typeof color !== "string" || !PRESET_COLORS.includes(color)) {
    return NextResponse.json(
      { error: "Valid color is required" },
      { status: 400 }
    );
  }
  const [existing, maxOrder] = await Promise.all([
    prisma.framework.findFirst({
      where: { name: name.trim() },
      select: { id: true },
    }),
    prisma.framework.aggregate({ _max: { sortOrder: true } }),
  ]);
  if (existing) {
    return NextResponse.json(
      { error: "Framework name already exists" },
      { status: 409 }
    );
  }
  const framework = await prisma.framework.create({
    data: { name: name.trim(), color, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  await Promise.all([
    touchLastModified(),
    logChange({
      entityType: "Framework",
      entityId: framework.id,
      entityName: framework.name,
      changeType: "create",
      newValue: framework.name,
    }),
  ]);
  return NextResponse.json(framework, { status: 201 });
}
