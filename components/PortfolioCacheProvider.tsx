"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export interface CachedTask {
  id: number;
  taskCode: string;
  name: string;
  assignee: string | null;
  priority: string;
  status: string;
  description: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  deliverable: string | null;
  attachments: { url: string; title: string | null }[] | null;
  dependencies: string | null;
  notes: string | null;
}

export interface CachedProject {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  actualCompletionDate: string | null;
  program: { id: number; name: string };
  tasks: CachedTask[];
}

interface PortfolioSeed {
  programs: {
    id: number;
    name: string;
    projects: Omit<CachedProject, "program">[];
  }[];
}

interface PortfolioCacheValue {
  getProject: (id: number) => CachedProject | null;
  setProject: (project: CachedProject) => void;
  removeProject: (id: number) => void;
  seedPortfolio: (frameworks: PortfolioSeed[], sourceVersion: string | null) => void;
  markDashboardNavigation: (projectId: number) => void;
  canReturnToDashboard: (projectId: number) => boolean;
  version: number;
}

const PortfolioCacheContext = createContext<PortfolioCacheValue | null>(null);

export default function PortfolioCacheProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const projects = useRef<Record<number, CachedProject>>({});
  const portfolioVersion = useRef<string | null>(null);
  const dashboardProjectId = useRef<number | null>(null);
  const [version, setVersion] = useState(0);

  const seedPortfolio = useCallback((
    frameworks: PortfolioSeed[],
    sourceVersion: string | null
  ) => {
    const replaceExisting =
      portfolioVersion.current !== null &&
      sourceVersion !== null &&
      portfolioVersion.current !== sourceVersion;
    if (replaceExisting) projects.current = {};

    let changed = false;
    for (const framework of frameworks) {
      for (const program of framework.programs) {
        for (const project of program.projects) {
          if (projects.current[project.id]) continue;
          projects.current[project.id] = {
            ...project,
            program: { id: program.id, name: program.name },
          };
          changed = true;
        }
      }
    }
    portfolioVersion.current = sourceVersion;
    if (changed) setVersion((current) => current + 1);
  }, []);

  const getProject = useCallback((id: number) => projects.current[id] || null, []);
  const setProject = useCallback((project: CachedProject) => {
    projects.current[project.id] = project;
    setVersion((current) => current + 1);
  }, []);
  const removeProject = useCallback((id: number) => {
    if (!projects.current[id]) return;
    delete projects.current[id];
    setVersion((current) => current + 1);
  }, []);
  const markDashboardNavigation = useCallback((projectId: number) => {
    dashboardProjectId.current = projectId;
  }, []);
  const canReturnToDashboard = useCallback(
    (projectId: number) => dashboardProjectId.current === projectId,
    []
  );
  const value = useMemo(
    () => ({
      getProject,
      setProject,
      removeProject,
      seedPortfolio,
      markDashboardNavigation,
      canReturnToDashboard,
      version,
    }),
    [canReturnToDashboard, getProject, markDashboardNavigation, removeProject, seedPortfolio, setProject, version]
  );

  return (
    <PortfolioCacheContext.Provider value={value}>
      {children}
    </PortfolioCacheContext.Provider>
  );
}

export function usePortfolioCache() {
  const value = useContext(PortfolioCacheContext);
  if (!value) throw new Error("usePortfolioCache must be used inside PortfolioCacheProvider");
  return value;
}
