import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsedPage = parseInt(searchParams.get("page") || "1");
  const parsedLimit = parseInt(searchParams.get("limit") || "50");
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(100, Math.max(1, parsedLimit))
    : 50;
  const entityType = searchParams.get("entityType");
  const changeType = searchParams.get("changeType");

  const where: Record<string, string> = {};
  if (entityType) where.entityType = entityType;
  if (changeType) where.changeType = changeType;

  const [logs, total] = await Promise.all([
    prisma.entityChangeLog.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.entityChangeLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
