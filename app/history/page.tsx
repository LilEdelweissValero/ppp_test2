import Link from "next/link";
import HistoryLogView from "@/components/HistoryLogView";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
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
              History Log
            </span>
          </div>

          <Link
            href="/"
            style={{
              fontSize: 11,
              color: "rgba(247,248,250,0.60)",
              textDecoration: "none",
              letterSpacing: "0.03em",
            }}
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 48px" }}>
        <HistoryLogView />
      </main>
    </div>
  );
}
