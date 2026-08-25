import { notFound } from "next/navigation";
import ProjectDetailView from "@/components/ProjectDetailView";
import CachedProjectRoute from "@/components/CachedProjectRoute";
import ProjectTimeTravel from "@/components/ProjectTimeTravel";
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
    <div style={{ background: "var(--ground)" }}>
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
