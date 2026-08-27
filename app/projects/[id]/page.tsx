import { notFound } from "next/navigation";
import Link from "next/link";
import ProjectDetailView from "@/components/ProjectDetailView";
import CachedProjectRoute from "@/components/CachedProjectRoute";
import ProjectTimeTravel from "@/components/ProjectTimeTravel";
import HeaderTimestamp from "@/components/HeaderTimestamp";
import { getProjectData, getDashboardData } from "@/lib/portfolio-data";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cached?: string; asOf?: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const query = await searchParams;
  const asOf = query.asOf || null;

  // Historical mode: always use server-render path to get snapshot data
  if (query.cached === "1" && !asOf) {
    return <CachedProjectRoute projectId={projectId} />;
  }

  const [project, { lastModifiedAt }] = await Promise.all([
    getProjectData(projectId),
    getDashboardData(),
  ]);
  if (!project) notFound();

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
              Project Detail
            </span>
          </div>

          <HeaderTimestamp iso={lastModifiedAt} historicalTimestamp={asOf} />
        </div>
      </header>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <ProjectTimeTravel
          iso={lastModifiedAt}
          historicalTimestamp={asOf}
        />
      </div>
      <ProjectDetailView project={project} historicalTimestamp={asOf} />
    </div>
  );
}
