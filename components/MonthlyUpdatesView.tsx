"use client";

import { useEffect, useRef, useState } from "react";

interface MonthData {
  status: string;
  progressPct: number;
  remarks: string;
}

interface ProjectRow {
  id: number;
  name: string;
  programName: string;
  frameworkName: string;
  frameworkColor: string;
  monthData: Record<string, MonthData>;
}

interface MonthColumn {
  key: string;
  label: string;
}

const STATUS_STYLES: Record<string, { bg: string; ink: string }> = {
  Completed: { bg: "var(--health-completed-bg)", ink: "var(--health-completed-ink)" },
  "In Progress": { bg: "var(--status-planning-bg)", ink: "var(--status-planning-ink)" },
  Delayed: { bg: "var(--health-atrisk-bg)", ink: "var(--health-atrisk-ink)" },
  "Not Yet Started": { bg: "var(--status-nys-bg)", ink: "var(--status-nys-ink)" },
  "Not Yet Due": { bg: "var(--health-notdue-bg)", ink: "var(--health-notdue-ink)" },
};

const FROZEN_COL_WIDTHS = { framework: 120, program: 150, project: 200 };

function computeRowSpans(projects: ProjectRow[]) {
  const fwkFirstRow = new Map<string, number>();
  const fwkSpans = new Map<string, number>();
  const progFirstRow = new Map<string, number>();
  const progSpans = new Map<string, number>();

  let lastFwk = "";
  let lastProg = "";
  let fwkCount = 0;
  let progCount = 0;

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];

    if (p.frameworkName !== lastFwk) {
      if (lastFwk !== "") {
        fwkSpans.set(lastFwk, fwkCount);
      }
      lastFwk = p.frameworkName;
      fwkCount = 1;
      fwkFirstRow.set(p.frameworkName, i);
    } else {
      fwkCount++;
    }

    const progKey = `${p.frameworkName}|${p.programName}`;
    if (progKey !== lastProg) {
      if (lastProg !== "") {
        progSpans.set(lastProg, progCount);
      }
      lastProg = progKey;
      progCount = 1;
      progFirstRow.set(progKey, i);
    } else {
      progCount++;
    }
  }

  if (lastFwk) fwkSpans.set(lastFwk, fwkCount);
  if (lastProg) progSpans.set(lastProg, progCount);

  return { fwkFirstRow, fwkSpans, progFirstRow, progSpans };
}

function EditableRemarks({
  value,
  onSave,
}: {
  value: string;
  onSave: (remarks: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  function handleSave() {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
    if (e.key === "Enter" && e.ctrlKey) {
      handleSave();
    }
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        rows={3}
        style={{
          width: "100%",
          fontSize: 11,
          fontFamily: "var(--font-sans)",
          padding: "4px 6px",
          border: "1px solid var(--accent)",
          borderRadius: 2,
          resize: "vertical",
          lineHeight: 1.4,
          color: "var(--ink-primary)",
          background: "var(--surface)",
          outline: "none",
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit remarks"
      style={{
        fontSize: 11,
        lineHeight: 1.4,
        color: "var(--ink-secondary)",
        cursor: "text",
        minHeight: 28,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        padding: "2px 0",
        borderBottom: "1px dashed var(--rule)",
      }}
    >
      {value || <span style={{ color: "var(--ink-tertiary)", fontStyle: "italic" }}>Click to add remarks</span>}
    </div>
  );
}

export default function MonthlyUpdatesView() {
  const [months, setMonths] = useState<MonthColumn[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/monthly-updates")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((data) => {
        setMonths(data.months || []);
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  async function handleRemarksSave(projectId: number, monthKey: string, remarks: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, monthData: { ...p.monthData, [monthKey]: { ...p.monthData[monthKey], remarks } } }
          : p
      )
    );

    try {
      await fetch("/api/monthly-updates/remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, monthKey, remarks }),
      });
    } catch {
      // Save failed — the optimistic update already reflected the change
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--ink-tertiary)", fontSize: 13 }}>
        Loading monthly updates...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--health-atrisk-ink)", fontSize: 13 }}>
        Error: {error}
      </div>
    );
  }

  if (months.length === 0 || projects.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 4,
        }}
      >
        <p style={{ fontSize: 13, color: "var(--ink-tertiary)", marginBottom: 8 }}>
          No history log entries found.
        </p>
        <p style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
          Monthly updates will appear once there are changes tracked in the history log.
        </p>
      </div>
    );
  }

  const { fwkFirstRow, fwkSpans, progFirstRow, progSpans } = computeRowSpans(projects);

  const frozenLeft = 0;
  const programLeft = FROZEN_COL_WIDTHS.framework;
  const projectLeft = programLeft + FROZEN_COL_WIDTHS.program;
  const totalFrozenWidth = projectLeft + FROZEN_COL_WIDTHS.project;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              minWidth: totalFrozenWidth + months.length * 220,
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: frozenLeft,
                    zIndex: 4,
                    background: "var(--ink-primary)",
                    color: "var(--ink-on-dark)",
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: "left",
                    width: FROZEN_COL_WIDTHS.framework,
                    minWidth: FROZEN_COL_WIDTHS.framework,
                    borderBottom: "2px solid var(--rule-strong)",
                    borderRight: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Framework
                </th>
                <th
                  style={{
                    position: "sticky",
                    left: programLeft,
                    zIndex: 4,
                    background: "var(--ink-primary)",
                    color: "var(--ink-on-dark)",
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: "left",
                    width: FROZEN_COL_WIDTHS.program,
                    minWidth: FROZEN_COL_WIDTHS.program,
                    borderBottom: "2px solid var(--rule-strong)",
                    borderRight: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Program
                </th>
                <th
                  style={{
                    position: "sticky",
                    left: projectLeft,
                    zIndex: 4,
                    background: "var(--ink-primary)",
                    color: "var(--ink-on-dark)",
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: "left",
                    width: FROZEN_COL_WIDTHS.project,
                    minWidth: FROZEN_COL_WIDTHS.project,
                    borderBottom: "2px solid var(--rule-strong)",
                    borderRight: "2px solid var(--rule-strong)",
                  }}
                >
                  Project
                </th>
                {months.map((m) => (
                  <th
                    key={m.key}
                    colSpan={2}
                    style={{
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: "center",
                      background: "var(--ground)",
                      color: "var(--ink-primary)",
                      borderBottom: "2px solid var(--rule-strong)",
                      borderRight: "1px solid var(--rule)",
                      minWidth: 220,
                    }}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: frozenLeft,
                    zIndex: 4,
                    background: "var(--ink-primary)",
                    borderBottom: "2px solid var(--rule-strong)",
                    height: 0,
                    padding: 0,
                    borderRight: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
                <th
                  style={{
                    position: "sticky",
                    left: programLeft,
                    zIndex: 4,
                    background: "var(--ink-primary)",
                    borderBottom: "2px solid var(--rule-strong)",
                    height: 0,
                    padding: 0,
                    borderRight: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
                <th
                  style={{
                    position: "sticky",
                    left: projectLeft,
                    zIndex: 4,
                    background: "var(--ink-primary)",
                    borderBottom: "2px solid var(--rule-strong)",
                    height: 0,
                    padding: 0,
                    borderRight: "2px solid var(--rule-strong)",
                  }}
                />
                {months.map((m) => (
                  <th
                    key={`${m.key}-sub`}
                    colSpan={2}
                    style={{ height: 0, padding: 0, borderBottom: "none" }}
                  >
                    <div style={{ display: "flex", height: 0 }}>
                      <div
                        style={{
                          width: 80,
                          fontSize: 9,
                          fontWeight: 600,
                          color: "var(--ink-tertiary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          textAlign: "center",
                          padding: "0 4px",
                          background: "var(--ground)",
                        }}
                      >
                        Status
                      </div>
                      <div
                        style={{
                          flex: 1,
                          fontSize: 9,
                          fontWeight: 600,
                          color: "var(--ink-tertiary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          textAlign: "center",
                          padding: "0 4px",
                          background: "var(--ground)",
                          borderLeft: "1px solid var(--rule)",
                        }}
                      >
                        Remarks
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((project, rowIdx) => {
                const fwkSpan = fwkSpans.get(project.frameworkName) || 1;
                const fwkFirst = fwkFirstRow.get(project.frameworkName) === rowIdx;
                const progKey = `${project.frameworkName}|${project.programName}`;
                const progSpan = progSpans.get(progKey) || 1;
                const progFirst = progFirstRow.get(progKey) === rowIdx;

                const isOdd = rowIdx % 2 === 1;
                const rowBg = isOdd ? "var(--ground)" : "var(--surface)";

                return (
                  <tr key={project.id} style={{ background: rowBg }}>
                    {fwkFirst && (
                      <td
                        rowSpan={fwkSpan}
                        style={{
                          position: "sticky",
                          left: frozenLeft,
                          zIndex: 2,
                          background: rowBg,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--ink-primary)",
                          borderBottom: "1px solid var(--rule)",
                          borderRight: "1px solid var(--rule)",
                          verticalAlign: "top",
                          width: FROZEN_COL_WIDTHS.framework,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: project.frameworkColor,
                              flexShrink: 0,
                            }}
                          />
                          <span>{project.frameworkName}</span>
                        </div>
                      </td>
                    )}
                    {progFirst && (
                      <td
                        rowSpan={progSpan}
                        style={{
                          position: "sticky",
                          left: programLeft,
                          zIndex: 2,
                          background: rowBg,
                          padding: "8px 12px",
                          fontSize: 12,
                          color: "var(--ink-primary)",
                          borderBottom: "1px solid var(--rule)",
                          borderRight: "1px solid var(--rule)",
                          verticalAlign: "top",
                          width: FROZEN_COL_WIDTHS.program,
                        }}
                      >
                        {project.programName}
                      </td>
                    )}
                    <td
                      style={{
                        position: "sticky",
                        left: projectLeft,
                        zIndex: 2,
                        background: rowBg,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--ink-primary)",
                        borderBottom: "1px solid var(--rule)",
                        borderRight: "2px solid var(--rule-strong)",
                        width: FROZEN_COL_WIDTHS.project,
                      }}
                    >
                      {project.name}
                    </td>
                    {months.map((m) => {
                      const data = project.monthData[m.key];
                      const status = data?.status || "Not Yet Started";
                      const style = STATUS_STYLES[status] || STATUS_STYLES["Not Yet Started"];

                      return (
                        <td
                          key={`${project.id}-${m.key}`}
                          style={{
                            padding: "6px 8px",
                            fontSize: 11,
                            borderBottom: "1px solid var(--rule)",
                            borderRight: "1px solid var(--rule)",
                            verticalAlign: "top",
                            width: 80,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 3,
                              background: style.bg,
                              color: style.ink,
                              whiteSpace: "nowrap",
                              marginBottom: 4,
                            }}
                          >
                            {status}
                          </span>
                        </td>
                      );
                    })}
                    {months.map((m) => {
                      const data = project.monthData[m.key];
                      const remarks = data?.remarks || `Project progress: ${data?.progressPct ?? 0}%`;

                      return (
                        <td
                          key={`${project.id}-${m.key}-remarks`}
                          style={{
                            padding: "6px 8px",
                            fontSize: 11,
                            borderBottom: "1px solid var(--rule)",
                            borderRight: "1px solid var(--rule)",
                            verticalAlign: "top",
                            minWidth: 140,
                          }}
                        >
                          <EditableRemarks
                            value={remarks}
                            onSave={(val) => handleRemarksSave(project.id, m.key, val)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          fontSize: 11,
          color: "var(--ink-secondary)",
        }}
      >
        <span style={{ fontWeight: 600, marginRight: 4 }}>Status Legend:</span>
        {Object.entries(STATUS_STYLES).map(([label, colors]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 2,
                background: colors.bg,
                border: `1px solid ${colors.ink}`,
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
