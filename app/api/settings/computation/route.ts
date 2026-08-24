import { NextResponse } from "next/server";
import {
  getSettings,
  saveSettings,
  migrateStatuses,
} from "@/lib/computation-settings-server";
import { validateHealthRules } from "@/lib/computation-settings";
import type { ComputationSettings } from "@/lib/computation-settings";
import { logChange, diffSettings } from "@/lib/audit-log";
import { touchLastModified } from "@/lib/system-metadata";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  try {
    const settings: ComputationSettings = await request.json();

    if (!Array.isArray(settings.statuses) || settings.statuses.length !== 5) {
      return NextResponse.json(
        { error: "Exactly 5 statuses are required." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(settings.healthRules) ||
      settings.healthRules.length !== 5
    ) {
      return NextResponse.json(
        { error: "Exactly 5 health rules are required." },
        { status: 400 }
      );
    }

    for (const s of settings.statuses) {
      if (typeof s.score !== "number" || s.score < 0 || s.score > 100) {
        return NextResponse.json(
          { error: `Invalid score for status "${s.name}".` },
          { status: 400 }
        );
      }
    }

    const validation = validateHealthRules(settings.healthRules);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error:
            "Health rules do not cover all possible project states. Uncovered: " +
            validation.gaps.join(", "),
        },
        { status: 400 }
      );
    }

    const oldSettings = await getSettings();
    const migrated = await migrateStatuses(oldSettings, settings);
    await saveSettings(settings);

    const details = diffSettings(oldSettings, settings);
    await logChange({
      entityType: "Settings",
      entityId: 0,
      entityName: "Computation Settings",
      changeType: "settings",
      oldValue: JSON.stringify(oldSettings),
      newValue: JSON.stringify(settings),
      details,
    });
    await touchLastModified();

    return NextResponse.json({ success: true, migrated });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
