"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
        </div>
      </header>
      <ProjectDetailView project={project} />
    </div>
  );
}
