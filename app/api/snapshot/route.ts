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
    // The project page asks for carried-over rows so it can render them amber;
    // the dashboard and monthly updates keep the default (carried items excluded).
    const includeCarriedOver = searchParams.get("includeCarriedOver") === "1";
    const snapshot = await getSnapshotAt(timestamp, false, includeCarriedOver);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Snapshot reconstruction failed:", error);
    return NextResponse.json(
      { error: "Failed to reconstruct snapshot" },
      { status: 500 }
    );
  }
}
