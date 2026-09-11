import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange, diffFields } from "@/lib/audit-log";
import { requireEdit } from "@/lib/edit-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const suchTask = await prisma.suchTask.findUnique({ where: { id: parseInt(id) } });
  if (!suchTask) {
    return NextResponse.json({ error: "SUCH task not found" }, { status: 404 });
  }
  return NextResponse.json(suchTask);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const blocked = await requireEdit();
  if (blocked) return blocked;
  const body = await request.json();
  const {
    suchTaskCode,
    name,
    sv,
    snv,
    nsv,
    dueQuarter,
    lastUpdatedDate,
    abandoned,
    abandonedReason,
    abandonedRemarks,
    phaseId,
  } = body;

  const existingTask = await prisma.suchTask.findUnique({ where: { id: parseInt(id) } });
  if (!existingTask) {
    return NextResponse.json({ error: "SUCH task not found" }, { status: 404 });
  }

  if (suchTaskCode !== undefined && suchTaskCode.trim() !== existingTask.suchTaskCode) {
    const newCode = suchTaskCode.trim();
    if (!newCode) {
      return NextResponse.json({ error: "SUCH task code cannot be empty" }, { status: 400 });
    }
    const duplicate = await prisma.suchTask.findFirst({
      where: { suchTaskCode: newCode, id: { not: parseInt(id) } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A SUCH task with this code already exists" },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, string | number | boolean | null> = {};
  if (suchTaskCode !== undefined) updateData.suchTaskCode = suchTaskCode.trim();
  if (name !== undefined) updateData.name = name.trim();
  if (sv !== undefined) updateData.sv = sv;
  if (snv !== undefined) updateData.snv = snv;
  if (nsv !== undefined) updateData.nsv = nsv;
  if (dueQuarter !== undefined) updateData.dueQuarter = dueQuarter;
  if (abandoned !== undefined && typeof abandoned === "boolean") {
    const abandonedAt = abandoned ? new Date().toISOString() : null;
    updateData.abandoned = abandoned;
    updateData.abandonedAt = abandonedAt;
    updateData.abandonedReason = abandoned ? abandonedReason ?? null : null;
    updateData.abandonedRemarks = abandoned ? abandonedRemarks ?? null : null;
  }
  if (phaseId !== undefined) updateData.phaseId = phaseId ? parseInt(phaseId) : null;

  // Auto-compute totalScheduled from sv + snv
  if (sv !== undefined || snv !== undefined) {
    const currentSv = sv !== undefined ? sv : existingTask.sv;
    const currentSnv = snv !== undefined ? snv : existingTask.snv;
    updateData.totalScheduled = currentSv + currentSnv;
  }

  // Auto-set lastUpdatedDate when numeric fields change (unless explicitly provided)
  const numericFieldsChanged = [sv, snv, nsv].some((v) => v !== undefined);
  if (numericFieldsChanged && lastUpdatedDate === undefined) {
    updateData.lastUpdatedDate = new Date().toISOString().slice(0, 10);
  } else if (lastUpdatedDate !== undefined) {
    updateData.lastUpdatedDate = lastUpdatedDate || null;
  }

  let suchTask;
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
        await tx.suchTask.update({ where: { id: parseInt(id) }, data: updateData });
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
          details: "SUCH task un-abandoned: cascade",
        });
      }
      if (parentProgram?.abandoned) {
        await logChange({
          entityType: "Program",
          entityId: parentProgram.id,
          entityName: parentProgram.name,
          changeType: "unabandon",
          details: "SUCH task un-abandoned: cascade",
        });
      }
      suchTask = await prisma.suchTask.findUnique({ where: { id: parseInt(id) } });
    } else {
      suchTask = await prisma.suchTask.update({
        where: { id: parseInt(id) },
        data: updateData,
      });
    }
  } else {
    suchTask = await prisma.suchTask.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
  }

  const details = diffFields(
    existingTask as Record<string, unknown>,
    updateData,
    ["suchTaskCode", "name", "totalScheduled", "sv", "snv", "nsv", "dueQuarter", "lastUpdatedDate"]
  );
  if (details) {
    await logChange({
      entityType: "SuchTask",
      entityId: suchTask.id,
      entityName: `${suchTask.suchTaskCode}: ${suchTask.name}`,
      changeType: "update",
      details,
    });
  }

  if (abandoned !== undefined && typeof abandoned === "boolean") {
    await logChange({
      entityType: "SuchTask",
      entityId: suchTask.id,
      entityName: `${suchTask.suchTaskCode}: ${suchTask.name}`,
      changeType: abandoned ? "abandon" : "unabandon",
      details: JSON.stringify({ reason: abandonedReason, remarks: abandonedRemarks }),
    });
  }

  await touchLastModified();
  return NextResponse.json(suchTask);
}
