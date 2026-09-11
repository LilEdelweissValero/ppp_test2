import { NextResponse } from "next/server";
import { hasEditAccess } from "@/lib/edit-auth";

export async function GET() {
  return NextResponse.json({ canEdit: await hasEditAccess() });
}
