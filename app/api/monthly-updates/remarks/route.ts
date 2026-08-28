import { NextRequest, NextResponse } from "next/server";
import { logChange } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, monthKey, remarks } = body;

    if (!projectId || !monthKey || typeof remarks !== "string") {
      return NextResponse.json(
        { error: "Missing required fields: projectId, monthKey, remarks" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { error: "Invalid monthKey format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    await logChange({
      entityType: "Project",
      entityId: projectId,
      entityName: monthKey,
      changeType: "remarks",
      oldValue: null,
      newValue: null,
      details: null,
      remarks,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remarks save error:", error);
    return NextResponse.json({ error: "Failed to save remarks" }, { status: 500 });
  }
}
