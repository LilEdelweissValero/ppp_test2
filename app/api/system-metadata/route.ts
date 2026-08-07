import { NextResponse } from "next/server";
import { getLastModifiedAt } from "@/lib/system-metadata";

export async function GET() {
  const lastModifiedAt = await getLastModifiedAt();
  return NextResponse.json({ lastModifiedAt });
}
