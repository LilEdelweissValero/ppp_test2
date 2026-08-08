import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const entityType = searchParams.get("entityType");
  const changeType = searchParams.get("changeType");

  const where: Record<string, string> = {};
  if (entityType) where.entityType = entityType;
  if (changeType) where.changeType = changeType;

  const [logs, total] = await Promise.all([
    prisma.entityChangeLog.findMany({
      where,
      orderBy: { seq: "desc" },
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
