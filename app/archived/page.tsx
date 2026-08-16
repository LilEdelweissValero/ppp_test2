import { getArchivedData } from "@/lib/portfolio-data";
import ArchivedView from "@/components/ArchivedView";
import LastUpdated from "@/components/LastUpdated";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const [frameworks, lastModified] = await Promise.all([
    getArchivedData(),
    prisma.systemMetadata.findUnique({
      where: { key: "lastModifiedAt" },
      select: { value: true },
    }),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "var(--ground)" }}>
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
              Archived Items
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
            <LastUpdated iso={lastModified?.value ?? null} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 48px" }}>
        <ArchivedView frameworks={frameworks} />
      </main>
    </div>
  );
}
