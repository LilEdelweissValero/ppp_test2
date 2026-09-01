import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFields } from "@/lib/audit-log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const specialTask = await prisma.specialTask.findUnique({ where: { id: parseInt(id) } });
  if (!specialTask) {
    return NextResponse.json({ error: "Special task not found" }, { status: 404 });
  }
  return NextResponse.json(specialTask);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    specialTaskCode,
    name,
    total,
    nys,
    plan,
    part,
    mostly,
    done,
    dueQuarter,
    lastUpdatedDate,
    abandoned,
    abandonedReason,
    abandonedRemarks,
    phaseId,
  } = body;

  const existingTask = await prisma.specialTask.findUnique({ where: { id: parseInt(id) } });
  if (!existingTask) {
    return NextResponse.json({ error: "Special task not found" }, { status: 404 });
  }

  if (specialTaskCode !== undefined && specialTaskCode.trim() !== existingTask.specialTaskCode) {
    const newCode = specialTaskCode.trim();
    if (!newCode) {
      return NextResponse.json({ error: "Special task code cannot be empty" }, { status: 400 });
    }
    const duplicate = await prisma.specialTask.findFirst({
      where: { specialTaskCode: newCode, id: { not: parseInt(id) } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A special task with this code already exists" },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, string | number | boolean | null> = {};
  if (specialTaskCode !== undefined) updateData.specialTaskCode = specialTaskCode.trim();
  if (name !== undefined) updateData.name = name.trim();
  if (total !== undefined) updateData.total = total;
  if (nys !== undefined) updateData.nys = nys;
  if (plan !== undefined) updateData.plan = plan;
  if (part !== undefined) updateData.part = part;
  if (mostly !== undefined) updateData.mostly = mostly;
  if (done !== undefined) updateData.done = done;
  if (dueQuarter !== undefined) updateData.dueQuarter = dueQuarter;
  if (abandoned !== undefined && typeof abandoned === "boolean") {
    const abandonedAt = abandoned ? new Date().toISOString() : null;
    updateData.abandoned = abandoned;
    updateData.abandonedAt = abandonedAt;
    updateData.abandonedReason = abandoned ? abandonedReason ?? null : null;
    updateData.abandonedRemarks = abandoned ? abandonedRemarks ?? null : null;
  }
  if (phaseId !== undefined) updateData.phaseId = phaseId ? parseInt(phaseId) : null;

  // Auto-set lastUpdatedDate when numeric fields change (unless explicitly provided)
  const numericFieldsChanged = [nys, plan, part, mostly, done].some((v) => v !== undefined);
  if (numericFieldsChanged && lastUpdatedDate === undefined) {
    updateData.lastUpdatedDate = new Date().toISOString().slice(0, 10);
  } else if (lastUpdatedDate !== undefined) {
    updateData.lastUpdatedDate = lastUpdatedDate || null;
  }

  let specialTask;
  const isUnabandon = abandoned !== undefined && abandoned === false;

  if (isUnabandon) {
    const parentProject = await prisma.project.findUnique({
      where: { id: existingTask.projectId },
      select: { id: true, abandoned: true, name: true, programId: true },
    });
    let parentProgram: { id: number; abandoned: boolean; name: string } | null = null;
    if (parentProject) {
      parentProgram = await prisma.program.findUnique({
        where: { id: parentProject.programId },
        select: { id: true, abandoned: true, name: true },
      });
    }

    const needsCascade = parentProject?.abandoned || parentProgram?.abandoned;

    if (needsCascade) {
      await prisma.$transaction(async (tx) => {
        await tx.specialTask.update({ where: { id: parseInt(id) }, data: updateData });
        if (parentProject?.abandoned) {
          await tx.project.update({
            where: { id: parentProject.id },
            data: { abandoned: false, abandonedAt: null, abandonedReason: null, abandonedRemarks: null },
          });
        }
        if (parentProgram?.abandoned) {
          await tx.program.update({
            where: { id: parentProgram.id },
            data: { abandoned: false, abandonedAt: null, abandonedReason: null, abandonedRemarks: null },
          });
        }
      });

      if (parentProject?.abandoned) {
        await logChange({
          entityType: "Project",
          entityId: parentProject.id,
          entityName: parentProject.name,
          changeType: "unabandon",
          details: "Special task un-abandoned: cascade",
        });
      }
      if (parentProgram?.abandoned) {
        await logChange({
          entityType: "Program",
          entityId: parentProgram.id,
          entityName: parentProgram.name,
          changeType: "unabandon",
          details: "Special task un-abandoned: cascade",
        });
      }
      specialTask = await prisma.specialTask.findUnique({ where: { id: parseInt(id) } });
    } else {
      specialTask = await prisma.specialTask.update({
        where: { id: parseInt(id) },
        data: updateData,
      });
    }
  } else {
    specialTask = await prisma.specialTask.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
  }

  const details = diffFields(
    existingTask as Record<string, unknown>,
    updateData,
    ["specialTaskCode", "name", "total", "nys", "plan", "part", "mostly", "done", "dueQuarter", "lastUpdatedDate"]
  );
  if (details) {
    await logChange({
      entityType: "SpecialTask",
      entityId: specialTask.id,
      entityName: `${specialTask.specialTaskCode}: ${specialTask.name}`,
      changeType: "update",
      details,
    });
  }

  if (abandoned !== undefined && typeof abandoned === "boolean") {
    await logChange({
      entityType: "SpecialTask",
      entityId: specialTask.id,
      entityName: `${specialTask.specialTaskCode}: ${specialTask.name}`,
      changeType: abandoned ? "abandon" : "unabandon",
      details: JSON.stringify({ reason: abandonedReason, remarks: abandonedRemarks }),
    });
  }

  await touchLastModified();
  return NextResponse.json(specialTask);
}
