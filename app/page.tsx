import { prisma } from "@/lib/db";
import { getLastModifiedAt } from "@/lib/system-metadata";
import DashboardView from "@/components/DashboardView";
import { compareQuarters } from "@/lib/quarters";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const frameworks = await prisma.framework.findMany({
    include: {
      programs: {
        include: {
          projects: {
            include: { tasks: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Collect distinct quarters from tasks and projects
  const taskQuarters = await prisma.task.findMany({
    select: { adjustedTargetQuarter: true },
    distinct: ["adjustedTargetQuarter"],
  });
  const projectQuarters = await prisma.project.findMany({
    select: { adjustedTargetQuarter: true },
    distinct: ["adjustedTargetQuarter"],
  });

  const quarterSet = new Set<string>();
  for (const q of taskQuarters) quarterSet.add(q.adjustedTargetQuarter);
  for (const q of projectQuarters) quarterSet.add(q.adjustedTargetQuarter);
  const existingQuarters = [...quarterSet].sort(compareQuarters);

  const lastModifiedAt = await getLastModifiedAt();
  let formattedDate = "Never";
  if (lastModifiedAt) {
    const date = new Date(lastModifiedAt);
    formattedDate =
      date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      " at " +
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ground)" }}>
      {/* ── Authority header ── */}
      <header
        style={{
          background: "var(--ink-primary)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: "0 auto",
            padding: "0 24px",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-on-dark)",
              }}
            >
              ITSD Project Tracker
            </span>
            <span
              style={{
                width: 1,
                height: 12,
                background: "rgba(255,255,255,0.18)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(247,248,250,0.40)",
                letterSpacing: "0.02em",
              }}
            >
              Portfolio Delivery Dashboard
            </span>
          </div>

          <div
            style={{
              fontSize: 11,
              color: "rgba(247,248,250,0.35)",
              letterSpacing: "0.03em",
            }}
          >
            <span style={{ color: "rgba(247,248,250,0.22)", marginRight: 6 }}>
              LAST UPDATED
            </span>
            {formattedDate}
          </div>
        </div>
      </header>

      {/* ── Dashboard body ── */}
      <main
        style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 48px" }}
      >
        <DashboardView frameworks={frameworks} existingQuarters={existingQuarters} />
      </main>
    </div>
  );
}
