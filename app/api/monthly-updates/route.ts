import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSnapshotAt } from "@/lib/snapshot";
import { compareQuarters } from "@/lib/quarters";

interface MonthData {
  status: string;
  progressPct: number;
  remarks: string;
}

interface ProjectRow {
  id: number;
  name: string;
  programName: string;
  frameworkName: string;
  frameworkColor: string;
  monthData: Record<string, MonthData>;
}

function computeHistoricalProgress(
  specialTasks: { total: number; plan: number; part: number; mostly: number; done: number }[]
): number {
  const total = specialTasks.reduce((s, st) => s + st.total, 0);
  if (total === 0) return 0;
  const weighted = specialTasks.reduce(
    (s, st) => s + st.plan * 25 + st.part * 50 + st.mostly * 75 + st.done * 100,
    0
  );
  return Math.round((weighted / total / 100) * 100);
}

function getProjectStatus(
  adjustedTargetQuarter: string,
  actualCompletionDate: string | null,
  progressPct: number,
  monthKey: string
): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const monthDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const monthQuarter = `Q${Math.floor(monthDate.getMonth() / 3) + 1} ${monthDate.getFullYear()}`;

  const isCompleted =
    actualCompletionDate !== null &&
    actualCompletionDate !== "" &&
    (() => {
      try {
        const completionMonth = new Date(actualCompletionDate);
        const completionQuarter = `Q${Math.floor(completionMonth.getMonth() / 3) + 1} ${completionMonth.getFullYear()}`;
        return compareQuarters(completionQuarter, monthQuarter) <= 0;
      } catch {
        return false;
      }
    })();

  if (isCompleted) return "Completed";

  const quarterComparison = compareQuarters(adjustedTargetQuarter, monthQuarter);

  if (progressPct === 0 && quarterComparison > 0) return "Not Yet Due";
  if (progressPct === 0 && quarterComparison <= 0) return "Not Yet Started";
  if (progressPct > 0 && quarterComparison >= 0) return "In Progress";
  if (quarterComparison < 0) return "Delayed";

  return "Not Yet Started";
}

export async function GET() {
  try {
    const allLogs = await prisma.entityChangeLog.findMany({
      orderBy: { id: "asc" },
    });

    if (allLogs.length === 0) {
      return NextResponse.json({ months: [], projects: [] });
    }

    const monthSet = new Set<string>();
    for (const log of allLogs) {
      if (log.createdAt && log.createdAt.length >= 7) {
        const ym = log.createdAt.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          monthSet.add(ym);
        }
      }
    }

    const sortedMonths = [...monthSet].sort();
    if (sortedMonths.length === 0) {
      return NextResponse.json({ months: [], projects: [] });
    }

    const monthLabels: { key: string; label: string }[] = sortedMonths.map((ym) => {
      const [y, m] = ym.split("-");
      const date = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return { key: ym, label };
    });

    const remarksMap = new Map<string, string>();
    for (const log of allLogs) {
      if (log.changeType === "remarks" && log.entityType === "Project" && log.remarks) {
        const ym = log.createdAt.slice(0, 7);
        const remarkKey = `${log.entityId}:${ym}`;
        remarksMap.set(remarkKey, log.remarks);
      }
    }

    const snapshots = new Map<string, Awaited<ReturnType<typeof getSnapshotAt>>>();
    for (const ym of sortedMonths) {
      const [y, m] = ym.split("-");
      const lastDay = new Date(parseInt(y), parseInt(m), 0);
      const timestamp = `${lastDay.toISOString().slice(0, 10)}T23:59:59.000Z`;
      const snapshot = await getSnapshotAt(timestamp);
      snapshots.set(ym, snapshot);
    }

    const projectMap = new Map<
      number,
      {
        id: number;
        name: string;
        programName: string;
        frameworkName: string;
        frameworkColor: string;
      }
    >();

    const projectMonthData = new Map<number, Record<string, MonthData>>();

    for (const ym of sortedMonths) {
      const snapshot = snapshots.get(ym)!;

      for (const fwk of snapshot.frameworks) {
        for (const prog of fwk.programs) {
          for (const proj of prog.projects) {
            if (!projectMap.has(proj.id)) {
              projectMap.set(proj.id, {
                id: proj.id,
                name: proj.name,
                programName: prog.name,
                frameworkName: fwk.name,
                frameworkColor: fwk.color,
              });
            }

            const progressPct = computeHistoricalProgress(proj.specialTasks);
            const status = getProjectStatus(
              proj.adjustedTargetQuarter,
              proj.actualCompletionDate,
              progressPct,
              ym
            );

            const remarkKey = `${proj.id}:${ym}`;
            const existingRemark = remarksMap.get(remarkKey);
            const defaultRemarks = `Project progress: ${progressPct}%`;

            if (!projectMonthData.has(proj.id)) {
              projectMonthData.set(proj.id, {});
            }
            projectMonthData.get(proj.id)![ym] = {
              status,
              progressPct,
              remarks: existingRemark || defaultRemarks,
            };
          }
        }
      }
    }

    const projects: ProjectRow[] = [];
    for (const [id, info] of projectMap) {
      projects.push({
        ...info,
        monthData: projectMonthData.get(id) || {},
      });
    }

    return NextResponse.json({ months: monthLabels, projects });
  } catch (error) {
    console.error("Monthly updates API error:", error);
    return NextResponse.json({ error: "Failed to fetch monthly updates" }, { status: 500 });
  }
}
