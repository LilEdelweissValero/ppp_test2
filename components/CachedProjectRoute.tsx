"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProjectDetailView from "@/components/ProjectDetailView";
import { usePortfolioCache } from "@/components/PortfolioCacheProvider";

export default function CachedProjectRoute({ projectId }: { projectId: number }) {
  const router = useRouter();
  const { getProject } = usePortfolioCache();
  const project = getProject(projectId);

  useEffect(() => {
    if (!project) {
      router.replace(`/projects/${projectId}`);
      return;
    }
    window.history.replaceState(null, "", `/projects/${projectId}`);
  }, [project, projectId, router]);

  if (!project) return null;
  return <ProjectDetailView project={project} />;
}
