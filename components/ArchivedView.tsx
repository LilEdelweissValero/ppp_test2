"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  computeProjectPercentComplete,
  computeProjectHealth,
  computeTaskPercentDone,
} from "@/lib/health";
import HealthBadge from "@/components/HealthBadge";

interface Task {
  id: number;
  taskCode: string;
  name: string;
  assignee: string | null;
  priority: string;
  status: string;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  deliverable: string | null;
  attachments: unknown;
  dependencies: string | null;
  notes: string | null;
}

interface Project {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  actualCompletionDate: string | null;
  tasks: Task[];
  specialTasks?: { id: number; specialTaskCode: string; name: string }[];
}

interface Program {
  id: number;
  name: string;
  frameworkId: number;
  projects: Project[];
}

interface Framework {
  id: number;
  name: string;
  color: string;
  programs: Program[];
}

interface Props {
  frameworks: Framework[];
}

export default function ArchivedView({ frameworks: initialFrameworks }: Props) {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState(initialFrameworks);
  const [loading, setLoading] = useState<number | null>(null);

  const totalPrograms = frameworks.reduce((sum, fw) => sum + fw.programs.length, 0);
  const totalProjects = frameworks.reduce(
    (sum, fw) => sum + fw.programs.reduce((s, p) => s + p.projects.length, 0),
    0
  );
  const totalTasks = frameworks.reduce(
    (sum, fw) =>
      sum +
      fw.programs.reduce(
        (s, p) => s + p.projects.reduce((s2, proj) => s2 + proj.tasks.length, 0),
        0
      ),
    0
  );

  async function handleUnarchive(entityType: string, entityId: number) {
    setLoading(entityId);
    try {
      const res = await fetch(`/api/${entityType.toLowerCase()}s/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/"
          style={{
            fontSize: 12,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-primary)", margin: 0 }}>
            Archived Items
          </h1>
          <p style={{ fontSize: 12, color: "var(--ink-tertiary)", margin: "4px 0 0" }}>
            {frameworks.length} framework{frameworks.length !== 1 ? "s" : ""} · {totalPrograms} program{totalPrograms !== 1 ? "s" : ""} · {totalProjects} project{totalProjects !== 1 ? "s" : ""} · {totalTasks} task{totalTasks !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {frameworks.length === 0 ? (
        <div
          style={{
            padding: "48px 32px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: 4,
          }}
        >
          <p style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>
            No archived items yet.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
            Archived items will appear here and can be restored at any time.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {frameworks.map((fw) => (
            <div
              key={fw.id}
              style={{
                border: "1px solid var(--rule)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {/* Framework header */}
              <div
                style={{
                  background: fw.color,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink-primary)" }}>
                    {fw.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                    {fw.programs.length} program{fw.programs.length !== 1 ? "s" : ""} ·{" "}
                    {fw.programs.reduce((s, p) => s + p.projects.length, 0)} project
                    {fw.programs.reduce((s, p) => s + p.projects.length, 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => handleUnarchive("framework", fw.id)}
                  disabled={loading === fw.id}
                  style={{
                    padding: "4px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent)",
                    background: "var(--surface)",
                    border: "1px solid var(--accent)",
                    borderRadius: 3,
                    cursor: "pointer",
                    opacity: loading === fw.id ? 0.5 : 1,
                  }}
                >
                  {loading === fw.id ? "Restoring..." : "Unarchive"}
                </button>
              </div>

              {/* Programs */}
              {fw.programs.map((prog) => (
                <div key={prog.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <div
                    style={{
                      padding: "8px 14px 8px 28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--ground)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-primary)" }}>
                        {prog.name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                        {prog.projects.length} project{prog.projects.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnarchive("program", prog.id)}
                      disabled={loading === prog.id}
                      style={{
                        padding: "3px 10px",
                        fontSize: 11,
                        color: "var(--accent)",
                        background: "none",
                        border: "1px solid var(--accent)",
                        borderRadius: 3,
                        cursor: "pointer",
                        opacity: loading === prog.id ? 0.5 : 1,
                      }}
                    >
                      {loading === prog.id ? "..." : "Unarchive"}
                    </button>
                  </div>

                  {/* Projects */}
                  {prog.projects.map((project) => {
                    const tasks = project.tasks;
                    const pct = computeProjectPercentComplete(tasks);
                    const health =
                      tasks.length > 0
                        ? computeProjectHealth(pct * 100, project.adjustedTargetQuarter)
                        : null;
                    return (
                      <div
                        key={project.id}
                        style={{
                          padding: "8px 14px 8px 44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderBottom: "1px solid var(--rule)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                          <Link
                            href={`/projects/${project.id}`}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--accent)",
                              textDecoration: "none",
                            }}
                          >
                            {project.name}
                          </Link>
                          <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                          </span>
                          <HealthBadge health={health} />
                          <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                            {Math.round(pct * 100)}%
                          </span>
                        </div>
                        <button
                          onClick={() => handleUnarchive("project", project.id)}
                          disabled={loading === project.id}
                          style={{
                            padding: "3px 10px",
                            fontSize: 11,
                            color: "var(--accent)",
                            background: "none",
                            border: "1px solid var(--accent)",
                            borderRadius: 3,
                            cursor: "pointer",
                            opacity: loading === project.id ? 0.5 : 1,
                          }}
                        >
                          {loading === project.id ? "..." : "Unarchive"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
