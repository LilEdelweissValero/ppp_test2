import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEdit } from "@/lib/edit-auth";

export const dynamic = "force-dynamic";

// Read-only ping so the hosted database registers activity. Deliberately does
// NOT call touchLastModified(): that writes a row and busts the portfolio cache.
export async function POST() {
  const blocked = await requireEdit();
  if (blocked) return blocked;
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.systemMetadata.count();
    return NextResponse.json({
      ok: true,
      pingedAt: new Date().toISOString(),
      ms: Date.now() - started,
    });
  } catch (err) {
    console.error("keepalive ping failed:", err);
    return NextResponse.json(
      { ok: false, error: "Database did not respond." },
      { status: 500 }
    );
  }
}
