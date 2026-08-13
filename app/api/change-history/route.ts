import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType and entityId are required" },
      { status: 400 }
    );
  }

  const logs = await prisma.entityChangeLog.findMany({
    where: {
      entityType,
      entityId: parseInt(entityId),
    },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(logs);
}
