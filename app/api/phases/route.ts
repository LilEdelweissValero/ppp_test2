import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  let body: { projectId?: number; phases?: Array<{ name: string; weight?: number }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { projectId, phases } = body;

  if (!projectId || !Array.isArray(phases) || phases.length === 0) {
    return NextResponse.json(
      { error: "projectId and phases array are required" },
      { status: 400 }
    );
  }

  // Validate weights sum to 100
  const totalWeight = phases.reduce(
    (sum: number, p: { weight?: number }) => sum + (p.weight ?? 0),
    0
  );
  if (Math.abs(totalWeight - 100) > 0.01) {
    return NextResponse.json(
      { error: `Phase weights must sum to 100%. Current total: ${totalWeight}%` },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const results = [];
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      const maxOrder = await tx.phase.aggregate({
        _max: { sortOrder: true },
        where: { projectId },
      });
      const phase = await tx.phase.create({
        data: {
          name: p.name,
          projectId,
          weight: p.weight ?? 0,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      await logChange({
        entityType: "Phase",
        entityId: phase.id,
        entityName: phase.name,
        changeType: "create",
      });
      results.push(phase);
    }
    return results;
  });

  await touchLastModified();
  return NextResponse.json(created);
}
