import Link from "next/link";
import { fetchCarriedOverData } from "@/lib/carried-over-data";
import CarriedOverView from "@/components/CarriedOverView";
import { hasEditAccess } from "@/lib/edit-auth";

export const dynamic = "force-dynamic";

export default async function CarriedOverPage() {
  const [data, canEdit] = await Promise.all([fetchCarriedOverData(), hasEditAccess()]);

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
            <Link
              href="/"
              style={{
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-on-dark)",
                textDecoration: "none",
              }}
            >
              ITSD Project Tracker
            </Link>
            <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.18)", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "rgba(247,248,250,0.40)", letterSpacing: "0.02em" }}>
              Parking Lot
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 48px" }}>
        <CarriedOverView data={data} canEdit={canEdit} />
      </main>
    </div>
  );
}
