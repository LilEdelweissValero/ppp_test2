import DashboardView from "@/components/DashboardView";
import HeaderTimestamp from "@/components/HeaderTimestamp";
import { compareQuarters } from "@/lib/quarters";
import { getDashboardData } from "@/lib/portfolio-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const query = await searchParams;
  const asOf = query.asOf || null;

  const { frameworks, lastModifiedAt } = await getDashboardData();

  const quarterSet = new Set<string>();
  for (const framework of frameworks) {
    for (const program of framework.programs) {
      for (const project of program.projects) {
        for (const task of project.tasks) {
          quarterSet.add(task.adjustedTargetQuarter);
        }
      }
    }
  }
  const existingQuarters = [...quarterSet].sort(compareQuarters);

  const isHistorical = !!asOf;

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

          <HeaderTimestamp iso={lastModifiedAt} historicalTimestamp={asOf} />
        </div>
      </header>

      {/* ── Historical mode banner ── */}
      {isHistorical && (
        <div
          style={{
            background: "var(--accent-bg)",
            borderBottom: "1px solid var(--accent)",
            padding: "8px 24px",
            fontSize: 12,
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 600 }}>Historical view</span>
          <span style={{ color: "var(--ink-secondary)" }}>
            &mdash; Viewing data as of the selected time. All edits are disabled.
          </span>
        </div>
      )}

      {/* ── Dashboard body ── */}
      <main
        style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 48px" }}
      >
        <DashboardView
          frameworks={frameworks}
          existingQuarters={existingQuarters}
          sourceVersion={lastModifiedAt}
          historicalTimestamp={asOf}
        />
      </main>
    </div>
  );
}
