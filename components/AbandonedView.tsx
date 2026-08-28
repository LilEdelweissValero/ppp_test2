"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AbandonedData } from "@/lib/abandoned-data";

interface Props {
  data: AbandonedData;
}

export default function AbandonedView({ data }: Props) {
  const router = useRouter();
  const [expandedPrograms, setExpandedPrograms] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<number | null>(null);

  const totalProjects = data.programs.reduce((sum, p) => sum + p.projects.length, 0) + data.projects.length;
  const totalTasks = data.programs.reduce((sum, p) => sum + p.projects.reduce((s, pr) => s + pr.tasks.length + pr.specialTasks.length, 0), 0)
    + data.projects.reduce((sum, p) => sum + p.tasks.length + p.specialTasks.length, 0)
    + data.tasks.length
    + data.specialTasks.length;

  function toggleProgram(id: number) {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleProject(id: number) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleUnabandon(entityType: string, entityId: number) {
    setLoading(entityId);
    try {
      const res = await fetch(`/api/${entityType === "SpecialTask" ? "special-tasks" : entityType.toLowerCase() + "s"}/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abandoned: false }),
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
            Abandoned Items
          </h1>
          <p style={{ fontSize: 12, color: "var(--ink-tertiary)", margin: "4px 0 0" }}>
            {data.programs.length} program{data.programs.length !== 1 ? "s" : ""} · {totalProjects} project{totalProjects !== 1 ? "s" : ""} · {totalTasks} task{totalTasks !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {data.programs.length === 0 && data.projects.length === 0 && data.tasks.length === 0 && data.specialTasks.length === 0 ? (
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
            No abandoned items yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Abandoned Programs */}
          {data.programs.length > 0 && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)", margin: "0 0 8px" }}>
                Abandoned Programs
              </h2>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--ground)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Framework</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Program</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)", width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.programs.map((prog) => (
                      <>
                        <tr
                          key={prog.id}
                          style={{ cursor: "pointer", background: expandedPrograms.has(prog.id) ? "var(--ground)" : "var(--surface)" }}
                          onClick={() => toggleProgram(prog.id)}
                        >
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>
                            <span style={{ fontSize: 10, marginRight: 6, transition: "transform 0.15s", transform: expandedPrograms.has(prog.id) ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                            {prog.framework.name}
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 500, borderBottom: "1px solid var(--rule)" }}>{prog.name}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnabandon("program", prog.id); }}
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
                              {loading === prog.id ? "..." : "Unabandon"}
                            </button>
                          </td>
                        </tr>
                        {expandedPrograms.has(prog.id) && prog.projects.map((proj) => (
                          <>
                            <tr
                              key={`proj-${proj.id}`}
                              style={{ cursor: "pointer", background: expandedProjects.has(proj.id) ? "var(--ground)" : "var(--surface)" }}
                              onClick={() => toggleProject(proj.id)}
                            >
                              <td style={{ padding: "6px 12px 6px 32px", borderBottom: "1px solid var(--rule)", fontSize: 11 }}>
                                <span style={{ fontSize: 9, marginRight: 6, transition: "transform 0.15s", transform: expandedProjects.has(proj.id) ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                                {proj.name}
                              </td>
                              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-tertiary)" }}>
                                {proj.tasks.length + proj.specialTasks.length} task{(proj.tasks.length + proj.specialTasks.length) !== 1 ? "s" : ""}
                              </td>
                              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnabandon("project", proj.id); }}
                                  disabled={loading === proj.id}
                                  style={{
                                    padding: "2px 8px",
                                    fontSize: 10,
                                    color: "var(--accent)",
                                    background: "none",
                                    border: "1px solid var(--accent)",
                                    borderRadius: 3,
                                    cursor: "pointer",
                                    opacity: loading === proj.id ? 0.5 : 1,
                                  }}
                                >
                                  {loading === proj.id ? "..." : "Unabandon"}
                                </button>
                              </td>
                            </tr>
                            {expandedProjects.has(proj.id) && proj.tasks.map((task) => (
                              <tr key={`task-${task.id}`}>
                                <td style={{ padding: "4px 12px 4px 56px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-tertiary)" }}>
                                  {task.taskCode}
                                </td>
                                <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", fontSize: 11 }}>
                                  {task.name}
                                </td>
                                <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUnabandon("task", task.id); }}
                                    disabled={loading === task.id}
                                    style={{
                                      padding: "2px 8px",
                                      fontSize: 10,
                                      color: "var(--accent)",
                                      background: "none",
                                      border: "1px solid var(--accent)",
                                      borderRadius: 3,
                                      cursor: "pointer",
                                      opacity: loading === task.id ? 0.5 : 1,
                                    }}
                                  >
                                    {loading === task.id ? "..." : "Unabandon"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {expandedProjects.has(proj.id) && proj.specialTasks.map((st) => (
                              <tr key={`st-${st.id}`}>
                                <td style={{ padding: "4px 12px 4px 56px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-tertiary)" }}>
                                  {st.specialTaskCode}
                                </td>
                                <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", fontSize: 11 }}>
                                  {st.name}
                                </td>
                                <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUnabandon("special-task", st.id); }}
                                    disabled={loading === st.id}
                                    style={{
                                      padding: "2px 8px",
                                      fontSize: 10,
                                      color: "var(--accent)",
                                      background: "none",
                                      border: "1px solid var(--accent)",
                                      borderRadius: 3,
                                      cursor: "pointer",
                                      opacity: loading === st.id ? 0.5 : 1,
                                    }}
                                  >
                                    {loading === st.id ? "..." : "Unabandon"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Abandoned Projects (not under abandoned program) */}
          {data.projects.length > 0 && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)", margin: "0 0 8px" }}>
                Abandoned Projects
              </h2>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--ground)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Framework</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Program</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Project</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)", width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map((proj) => (
                      <>
                        <tr
                          key={proj.id}
                          style={{ cursor: "pointer", background: expandedProjects.has(proj.id) ? "var(--ground)" : "var(--surface)" }}
                          onClick={() => toggleProject(proj.id)}
                        >
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>
                            <span style={{ fontSize: 10, marginRight: 6, transition: "transform 0.15s", transform: expandedProjects.has(proj.id) ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                            {proj.program.name}
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>{proj.program.name}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 500, borderBottom: "1px solid var(--rule)" }}>{proj.name}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnabandon("project", proj.id); }}
                              disabled={loading === proj.id}
                              style={{
                                padding: "3px 10px",
                                fontSize: 11,
                                color: "var(--accent)",
                                background: "none",
                                border: "1px solid var(--accent)",
                                borderRadius: 3,
                                cursor: "pointer",
                                opacity: loading === proj.id ? 0.5 : 1,
                              }}
                            >
                              {loading === proj.id ? "..." : "Unabandon"}
                            </button>
                          </td>
                        </tr>
                        {expandedProjects.has(proj.id) && proj.tasks.map((task) => (
                          <tr key={`task-${task.id}`}>
                            <td style={{ padding: "4px 12px 4px 32px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-tertiary)" }} colSpan={2}>
                              {task.taskCode}
                            </td>
                            <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", fontSize: 11 }}>
                              {task.name}
                            </td>
                            <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnabandon("task", task.id); }}
                                disabled={loading === task.id}
                                style={{
                                  padding: "2px 8px",
                                  fontSize: 10,
                                  color: "var(--accent)",
                                  background: "none",
                                  border: "1px solid var(--accent)",
                                  borderRadius: 3,
                                  cursor: "pointer",
                                  opacity: loading === task.id ? 0.5 : 1,
                                }}
                              >
                                {loading === task.id ? "..." : "Unabandon"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {expandedProjects.has(proj.id) && proj.specialTasks.map((st) => (
                          <tr key={`st-${st.id}`}>
                            <td style={{ padding: "4px 12px 4px 32px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-tertiary)" }} colSpan={2}>
                              {st.specialTaskCode}
                            </td>
                            <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", fontSize: 11 }}>
                              {st.name}
                            </td>
                            <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnabandon("special-task", st.id); }}
                                disabled={loading === st.id}
                                style={{
                                  padding: "2px 8px",
                                  fontSize: 10,
                                  color: "var(--accent)",
                                  background: "none",
                                  border: "1px solid var(--accent)",
                                  borderRadius: 3,
                                  cursor: "pointer",
                                  opacity: loading === st.id ? 0.5 : 1,
                                }}
                              >
                                {loading === st.id ? "..." : "Unabandon"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Abandoned Tasks (not under abandoned project/program) */}
          {(data.tasks.length > 0 || data.specialTasks.length > 0) && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)", margin: "0 0 8px" }}>
                Abandoned Tasks
              </h2>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--ground)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Framework</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Program</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Project</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)" }}>Task</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "var(--ink-secondary)", borderBottom: "1px solid var(--rule)", width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map((task) => (
                      <tr key={task.id}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>{task.project.program.framework.name}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>{task.project.program.name}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>{task.project.name}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 500, borderBottom: "1px solid var(--rule)" }}>
                          <span style={{ color: "var(--ink-tertiary)", marginRight: 6 }}>{task.taskCode}</span>
                          {task.name}
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                          <button
                            onClick={() => handleUnabandon("task", task.id)}
                            disabled={loading === task.id}
                            style={{
                              padding: "3px 10px",
                              fontSize: 11,
                              color: "var(--accent)",
                              background: "none",
                              border: "1px solid var(--accent)",
                              borderRadius: 3,
                              cursor: "pointer",
                              opacity: loading === task.id ? 0.5 : 1,
                            }}
                          >
                            {loading === task.id ? "..." : "Unabandon"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {data.specialTasks.map((st) => (
                      <tr key={`st-${st.id}`}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>{st.project.program.framework.name}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>{st.project.program.name}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>{st.project.name}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 500, borderBottom: "1px solid var(--rule)" }}>
                          <span style={{ color: "var(--ink-tertiary)", marginRight: 6 }}>{st.specialTaskCode}</span>
                          {st.name}
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>
                          <button
                            onClick={() => handleUnabandon("special-task", st.id)}
                            disabled={loading === st.id}
                            style={{
                              padding: "3px 10px",
                              fontSize: 11,
                              color: "var(--accent)",
                              background: "none",
                              border: "1px solid var(--accent)",
                              borderRadius: 3,
                              cursor: "pointer",
                              opacity: loading === st.id ? 0.5 : 1,
                            }}
                          >
                            {loading === st.id ? "..." : "Unabandon"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
