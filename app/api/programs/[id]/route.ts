import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { touchLastModified } from "@/lib/system-metadata";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, frameworkId } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const existing = await prisma.program.findFirst({
    where: { name: name.trim(), NOT: { id: parseInt(id) } },
  });
  if (existing) {
    return NextResponse.json({ error: "Program name already exists" }, { status: 409 });
  }
  const updateData: Record<string, string | number> = { name: name.trim() };
  if (frameworkId) {
    updateData.frameworkId = parseInt(frameworkId);
  }
  const program = await prisma.program.update({
    where: { id: parseInt(id) },
    data: updateData,
  });
  await touchLastModified();
  return NextResponse.json(program);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectCount = await prisma.project.count({
    where: { programId: parseInt(id) },
  });
  if (projectCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete program with attached projects" },
      { status: 400 }
    );
  }
  await prisma.program.delete({ where: { id: parseInt(id) } });
  await touchLastModified();
  return NextResponse.json({ ok: true });
}
