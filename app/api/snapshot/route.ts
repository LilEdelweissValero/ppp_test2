import { NextRequest, NextResponse } from "next/server";
import { getSnapshotAt } from "@/lib/snapshot";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timestamp = searchParams.get("timestamp");

  if (!timestamp) {
    return NextResponse.json(
      { error: "timestamp query parameter is required (ISO 8601)" },
      { status: 400 }
    );
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return NextResponse.json(
      { error: "Invalid timestamp. Must be a valid ISO 8601 date string." },
      { status: 400 }
    );
  }

  try {
    const snapshot = await getSnapshotAt(timestamp);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Snapshot reconstruction failed:", error);
    return NextResponse.json(
      { error: "Failed to reconstruct snapshot" },
      { status: 500 }
    );
  }
}
