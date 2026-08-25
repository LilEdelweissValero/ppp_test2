import { notFound } from "next/navigation";
import ProjectDetailView from "@/components/ProjectDetailView";
import CachedProjectRoute from "@/components/CachedProjectRoute";
import { getProjectData } from "@/lib/portfolio-data";

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
  if (query.cached === "1") {
    return <CachedProjectRoute projectId={projectId} />;
  }

  const project = await getProjectData(projectId);
  if (!project) notFound();

  return <ProjectDetailView project={project} historicalTimestamp={query.asOf || null} />;
}
