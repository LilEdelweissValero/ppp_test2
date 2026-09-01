"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AbandonedData } from "@/lib/abandoned-data";
import UnabandonConfirmModal from "./UnabandonConfirmModal";

interface Props {
  data: AbandonedData;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const thBase: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 600,
  color: "var(--ink-secondary)",
  borderBottom: "1px solid var(--rule)",
};

const thRight: React.CSSProperties = {
  ...thBase,
  textAlign: "right",
  width: 100,
};

const cellBase: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--rule)",
};

const cellSmall: React.CSSProperties = {
  ...cellBase,
  padding: "6px 12px",
  fontSize: 11,
};

const cellAction: React.CSSProperties = {
  ...cellBase,
  textAlign: "right",
};

const cellActionSmall: React.CSSProperties = {
  ...cellAction,
  padding: "6px 12px",
};

const cellNested: React.CSSProperties = {
  padding: "4px 12px",
  borderBottom: "1px solid var(--rule)",
  fontSize: 11,
};

const cellNestedLeft: React.CSSProperties = {
  ...cellNested,
  paddingLeft: 56,
  color: "var(--ink-tertiary)",
};

const cellNestedLeft2: React.CSSProperties = {
  ...cellNested,
  paddingLeft: 32,
  color: "var(--ink-tertiary)",
};

const btnSmall: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: 10,
  color: "var(--accent)",
  background: "none",
  border: "1px solid var(--accent)",
  borderRadius: 3,
  cursor: "pointer",
};

const btnNormal: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: 11,
  color: "var(--accent)",
  background: "none",
  border: "1px solid var(--accent)",
  borderRadius: 3,
  cursor: "pointer",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 9,
  padding: "1px 5px",
  borderRadius: 3,
  background: "var(--ground)",
  color: "var(--ink-tertiary)",
  border: "1px solid var(--rule)",
  marginLeft: 6,
  fontWeight: 500,
  whiteSpace: "nowrap",
};

export default function AbandonedView({ data }: Props) {
  const router = useRouter();
  const [expandedPrograms, setExpandedPrograms] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<number | null>(null);
  const [unabandonTarget, setUnabandonTarget] = useState<{
    entityType: string;
    entityId: number;
    entityName: string;
    parents: Array<{ type: "Project" | "Program"; name: string }>;
  } | null>(null);

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

  function handleUnabandon(
    entityType: string,
    entityId: number,
    entityName: string,
    parents: Array<{ type: "Project" | "Program"; name: string }>,
  ) {
    if (parents.length > 0) {
      setUnabandonTarget({ entityType, entityId, entityName, parents });
    } else {
      doUnabandon(entityType, entityId);
    }
  }

  async function doUnabandon(entityType: string, entityId: number) {
    setLoading(entityId);
    try {
      const endpoint = entityType === "SpecialTask" ? "special-tasks" : entityType.toLowerCase() + "s";
      const res = await fetch(`/api/${endpoint}/${entityId}`, {
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

  function handleUnabandonConfirm() {
    if (!unabandonTarget) return;
    const { entityType, entityId } = unabandonTarget;
    setUnabandonTarget(null);
    doUnabandon(entityType, entityId);
  }

  function reasonCell(entity: { abandonedReason: string | null; abandonedRemarks: string | null }) {
    return (
      <td style={{ ...cellSmall, fontSize: 11 }}>
        {entity.abandonedReason ? (
          <div style={{ fontWeight: 500 }}>{entity.abandonedReason}</div>
        ) : null}
        {entity.abandonedRemarks ? (
          <div style={{ color: "var(--ink-tertiary)", fontSize: 10, marginTop: 2 }}>
            {entity.abandonedRemarks}
          </div>
        ) : null}
        {!entity.abandonedReason && !entity.abandonedRemarks ? (
          <span style={{ color: "var(--ink-tertiary)" }}>—</span>
        ) : null}
      </td>
    );
  }

  function dateCell(entity: { abandonedAt: string | null }) {
    return (
      <td style={{ ...cellSmall, whiteSpace: "nowrap" }}>
        {entity.abandonedAt ? formatDate(entity.abandonedAt) : "—"}
      </td>
    );
  }

  function reasonCellNested(entity: { abandonedReason: string | null; abandonedRemarks: string | null }) {
    return (
      <td style={{ ...cellNested, fontSize: 11 }}>
        {entity.abandonedReason ? (
          <div style={{ fontWeight: 500 }}>{entity.abandonedReason}</div>
        ) : null}
        {entity.abandonedRemarks ? (
          <div style={{ color: "var(--ink-tertiary)", fontSize: 10, marginTop: 2 }}>
            {entity.abandonedRemarks}
          </div>
        ) : null}
        {!entity.abandonedReason && !entity.abandonedRemarks ? (
          <span style={{ color: "var(--ink-tertiary)" }}>—</span>
        ) : null}
      </td>
    );
  }

  function dateCellNested(entity: { abandonedAt: string | null }) {
    return (
      <td style={{ ...cellNested, whiteSpace: "nowrap" }}>
        {entity.abandonedAt ? formatDate(entity.abandonedAt) : "—"}
      </td>
    );
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
          {/* ═══════════ Abandoned Programs ═══════════ */}
          {data.programs.length > 0 && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)", margin: "0 0 8px" }}>
                Abandoned Programs
              </h2>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                <table className="detail-task-table">
                  <thead>
                    <tr style={{ background: "var(--ground)" }}>
                      <th style={thBase}>Framework</th>
                      <th style={thBase}>Program</th>
                      <th style={thBase}>Reason</th>
                      <th style={thBase}>Abandoned At</th>
                      <th style={thRight}></th>
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
                          <td style={cellBase}>
                            <span style={{ fontSize: 10, marginRight: 6, transition: "transform 0.15s", transform: expandedPrograms.has(prog.id) ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                            {prog.framework.name}
                          </td>
                          <td style={{ ...cellBase, fontWeight: 500 }}>{prog.name}</td>
                          {reasonCell(prog)}
                          {dateCell(prog)}
                          <td style={cellAction}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnabandon("program", prog.id, prog.name, []); }}
                              disabled={loading === prog.id}
                              style={{ ...btnNormal, opacity: loading === prog.id ? 0.5 : 1 }}
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
                              <td style={{ ...cellSmall, paddingLeft: 32 }}>
                                <span style={{ fontSize: 9, marginRight: 6, transition: "transform 0.15s", transform: expandedProjects.has(proj.id) ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                                {proj.name}
                              </td>
                              <td style={{ ...cellSmall, color: "var(--ink-tertiary)" }}>
                                {proj.tasks.length + proj.specialTasks.length} task{(proj.tasks.length + proj.specialTasks.length) !== 1 ? "s" : ""}
                              </td>
                              {reasonCell(proj)}
                              {dateCell(proj)}
                              <td style={cellActionSmall}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnabandon("project", proj.id, proj.name, [{ type: "Program", name: prog.name }]); }}
                                  disabled={loading === proj.id}
                                  style={{ ...btnSmall, opacity: loading === proj.id ? 0.5 : 1 }}
                                >
                                  {loading === proj.id ? "..." : "Unabandon"}
                                </button>
                              </td>
                            </tr>
                            {expandedProjects.has(proj.id) && proj.tasks.map((task) => (
                              <tr key={`task-${task.id}`}>
                                <td style={cellNestedLeft}>
                                  {task.taskCode}
                                </td>
                                <td style={cellNested}>
                                  {task.name}
                                </td>
                                {reasonCellNested(task)}
                                {dateCellNested(task)}
                                <td style={{ ...cellNested, textAlign: "right" }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUnabandon("task", task.id, task.name, [{ type: "Project", name: proj.name }, { type: "Program", name: prog.name }]); }}
                                    disabled={loading === task.id}
                                    style={{ ...btnSmall, opacity: loading === task.id ? 0.5 : 1 }}
                                  >
                                    {loading === task.id ? "..." : "Unabandon"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {expandedProjects.has(proj.id) && proj.specialTasks.map((st) => (
                              <tr key={`st-${st.id}`}>
                                <td style={cellNestedLeft}>
                                  {st.specialTaskCode}
                                </td>
                                <td style={cellNested}>
                                  {st.name}
                                </td>
                                {reasonCellNested(st)}
                                {dateCellNested(st)}
                                <td style={{ ...cellNested, textAlign: "right" }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUnabandon("special-task", st.id, st.name, [{ type: "Project", name: proj.name }, { type: "Program", name: prog.name }]); }}
                                    disabled={loading === st.id}
                                    style={{ ...btnSmall, opacity: loading === st.id ? 0.5 : 1 }}
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

          {/* ═══════════ Abandoned Projects (not under abandoned program) ═══════════ */}
          {data.projects.length > 0 && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)", margin: "0 0 8px" }}>
                Abandoned Projects
              </h2>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                <table className="detail-task-table">
                  <thead>
                    <tr style={{ background: "var(--ground)" }}>
                      <th style={thBase}>Framework</th>
                      <th style={thBase}>Program</th>
                      <th style={thBase}>Project</th>
                      <th style={thBase}>Reason</th>
                      <th style={thBase}>Abandoned At</th>
                      <th style={thRight}></th>
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
                          <td style={cellBase}>
                            <span style={{ fontSize: 10, marginRight: 6, transition: "transform 0.15s", transform: expandedProjects.has(proj.id) ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                            {proj.program.name}
                            <span style={badgeStyle}>NOT ABANDONED</span>
                          </td>
                          <td style={cellBase}>{proj.program.name}</td>
                          <td style={{ ...cellBase, fontWeight: 500 }}>{proj.name}</td>
                          {reasonCell(proj)}
                          {dateCell(proj)}
                          <td style={cellAction}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnabandon("project", proj.id, proj.name, []); }}
                              disabled={loading === proj.id}
                              style={{ ...btnNormal, opacity: loading === proj.id ? 0.5 : 1 }}
                            >
                              {loading === proj.id ? "..." : "Unabandon"}
                            </button>
                          </td>
                        </tr>
                        {expandedProjects.has(proj.id) && proj.tasks.map((task) => (
                          <tr key={`task-${task.id}`}>
                            <td style={cellNestedLeft2} colSpan={2}>
                              {task.taskCode}
                            </td>
                            <td style={cellNested}>
                              {task.name}
                            </td>
                            {reasonCellNested(task)}
                            {dateCellNested(task)}
                            <td style={{ ...cellNested, textAlign: "right" }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnabandon("task", task.id, task.name, [{ type: "Project", name: proj.name }]); }}
                                disabled={loading === task.id}
                                style={{ ...btnSmall, opacity: loading === task.id ? 0.5 : 1 }}
                              >
                                {loading === task.id ? "..." : "Unabandon"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {expandedProjects.has(proj.id) && proj.specialTasks.map((st) => (
                          <tr key={`st-${st.id}`}>
                            <td style={cellNestedLeft2} colSpan={2}>
                              {st.specialTaskCode}
                            </td>
                            <td style={cellNested}>
                              {st.name}
                            </td>
                            {reasonCellNested(st)}
                            {dateCellNested(st)}
                            <td style={{ ...cellNested, textAlign: "right" }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnabandon("special-task", st.id, st.name, [{ type: "Project", name: proj.name }]); }}
                                disabled={loading === st.id}
                                style={{ ...btnSmall, opacity: loading === st.id ? 0.5 : 1 }}
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

          {/* ═══════════ Abandoned Tasks (not under abandoned project/program) ═══════════ */}
          {(data.tasks.length > 0 || data.specialTasks.length > 0) && (
            <section>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)", margin: "0 0 8px" }}>
                Abandoned Tasks
              </h2>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                <table className="detail-task-table">
                  <thead>
                    <tr style={{ background: "var(--ground)" }}>
                      <th style={thBase}>Framework</th>
                      <th style={thBase}>Program</th>
                      <th style={thBase}>Project</th>
                      <th style={thBase}>Reason</th>
                      <th style={thBase}>Abandoned At</th>
                      <th style={thRight}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map((task) => (
                      <tr key={task.id}>
                        <td style={cellBase}>{task.project.program.framework.name}</td>
                        <td style={cellBase}>
                          {task.project.program.name}
                          <span style={badgeStyle}>NOT ABANDONED</span>
                        </td>
                        <td style={cellBase}>
                          {task.project.name}
                          <span style={badgeStyle}>NOT ABANDONED</span>
                        </td>
                        {reasonCell(task)}
                        {dateCell(task)}
                        <td style={cellAction}>
                          <button
                            onClick={() => handleUnabandon("task", task.id, task.name, [])}
                            disabled={loading === task.id}
                            style={{ ...btnNormal, opacity: loading === task.id ? 0.5 : 1 }}
                          >
                            {loading === task.id ? "..." : "Unabandon"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {data.specialTasks.map((st) => (
                      <tr key={`st-${st.id}`}>
                        <td style={cellBase}>{st.project.program.framework.name}</td>
                        <td style={cellBase}>
                          {st.project.program.name}
                          <span style={badgeStyle}>NOT ABANDONED</span>
                        </td>
                        <td style={cellBase}>
                          {st.project.name}
                          <span style={badgeStyle}>NOT ABANDONED</span>
                        </td>
                        {reasonCell(st)}
                        {dateCell(st)}
                        <td style={cellAction}>
                          <button
                            onClick={() => handleUnabandon("special-task", st.id, st.name, [])}
                            disabled={loading === st.id}
                            style={{ ...btnNormal, opacity: loading === st.id ? 0.5 : 1 }}
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

      {unabandonTarget && (
        <UnabandonConfirmModal
          open={!!unabandonTarget}
          onClose={() => setUnabandonTarget(null)}
          onConfirm={handleUnabandonConfirm}
          entityType={unabandonTarget.entityType as "task" | "special-task" | "project"}
          entityName={unabandonTarget.entityName}
          parentsToUnabandon={unabandonTarget.parents}
          loading={loading !== null}
        />
      )}
    </div>
  );
}
