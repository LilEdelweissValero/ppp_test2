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

const cellNested: React.CSSProperties = {
  padding: "4px 12px",
  borderBottom: "1px solid var(--rule)",
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

  const totalProjects = data.programs.reduce((sum, p) => sum + p.projects.length, 0);
  const totalTasks = data.programs.reduce(
    (sum, p) => sum + p.projects.reduce((s, pr) => s + pr.tasks.length, 0),
    0,
  );

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

  function renderReasonCell(
    entity: { abandonedReason: string | null; abandonedRemarks: string | null },
    nested = false,
  ) {
    const style = nested ? cellNested : cellSmall;
    return (
      <td style={{ ...style, fontSize: 11 }}>
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

  function renderDateCell(entity: { abandonedAt: string | null }, nested = false) {
    const style = nested ? cellNested : cellSmall;
    return (
      <td style={{ ...style, whiteSpace: "nowrap" }}>
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

      {data.programs.length === 0 ? (
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
              {data.programs.map((prog) => (
                <ProgramRow
                  key={prog.id}
                  prog={prog}
                  expanded={expandedPrograms.has(prog.id)}
                  expandedProjects={expandedProjects}
                  onToggleProgram={() => toggleProgram(prog.id)}
                  onToggleProject={toggleProject}
                  onUnabandon={handleUnabandon}
                  loading={loading}
                />
              ))}
            </tbody>
          </table>
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

function ProgramRow({
  prog,
  expanded,
  expandedProjects,
  onToggleProgram,
  onToggleProject,
  onUnabandon,
  loading,
}: {
  prog: AbandonedData["programs"][number];
  expanded: boolean;
  expandedProjects: Set<number>;
  onToggleProgram: () => void;
  onToggleProject: (id: number) => void;
  onUnabandon: (
    entityType: string,
    entityId: number,
    entityName: string,
    parents: Array<{ type: "Project" | "Program"; name: string }>,
  ) => void;
  loading: number | null;
}) {
  const isAbandoned = prog.abandoned;

  return (
    <>
      <tr
        style={{ cursor: "pointer", background: expanded ? "var(--ground)" : "var(--surface)" }}
        onClick={onToggleProgram}
      >
        <td style={cellBase}>
          <span style={{ fontSize: 10, marginRight: 6, transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
          {prog.framework.name}
        </td>
        <td style={{ ...cellBase, fontWeight: 500 }}>
          {prog.name}
          {!isAbandoned && <span style={badgeStyle}>NOT ABANDONED</span>}
        </td>
        <td style={cellBase}></td>
        <td style={{ ...cellBase, fontSize: 11 }}>
          {prog.abandonedReason ? (
            <div style={{ fontWeight: 500 }}>{prog.abandonedReason}</div>
          ) : null}
          {prog.abandonedRemarks ? (
            <div style={{ color: "var(--ink-tertiary)", fontSize: 10, marginTop: 2 }}>
              {prog.abandonedRemarks}
            </div>
          ) : null}
          {!prog.abandonedReason && !prog.abandonedRemarks ? (
            <span style={{ color: "var(--ink-tertiary)" }}>—</span>
          ) : null}
        </td>
        <td style={{ ...cellSmall, whiteSpace: "nowrap" }}>
          {prog.abandonedAt ? formatDate(prog.abandonedAt) : "—"}
        </td>
        <td style={cellAction}>
          {isAbandoned ? (
            <button
              onClick={(e) => { e.stopPropagation(); onUnabandon("program", prog.id, prog.name, []); }}
              disabled={loading === prog.id}
              style={{ ...btnNormal, opacity: loading === prog.id ? 0.5 : 1 }}
            >
              {loading === prog.id ? "..." : "Unabandon"}
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && prog.projects.map((proj) => (
        <ProjectRow
          key={`proj-${proj.id}`}
          proj={proj}
          progName={prog.name}
          expandedProjects={expandedProjects}
          onToggleProject={onToggleProject}
          onUnabandon={onUnabandon}
          loading={loading}
        />
      ))}
    </>
  );
}

function ProjectRow({
  proj,
  progName,
  expandedProjects,
  onToggleProject,
  onUnabandon,
  loading,
}: {
  proj: AbandonedData["programs"][number]["projects"][number];
  progName: string;
  expandedProjects: Set<number>;
  onToggleProject: (id: number) => void;
  onUnabandon: (
    entityType: string,
    entityId: number,
    entityName: string,
    parents: Array<{ type: "Project" | "Program"; name: string }>,
  ) => void;
  loading: number | null;
}) {
  const isAbandoned = proj.abandoned;
  const expanded = expandedProjects.has(proj.id);

  return (
    <>
      <tr
        key={`proj-${proj.id}`}
        style={{ cursor: "pointer", background: expanded ? "var(--ground)" : "var(--surface)" }}
        onClick={() => onToggleProject(proj.id)}
      >
        <td style={{ ...cellSmall, paddingLeft: 32 }}></td>
        <td style={{ ...cellSmall, color: "var(--ink-tertiary)" }}>
          {proj.tasks.length} task{proj.tasks.length !== 1 ? "s" : ""}
        </td>
        <td style={{ ...cellSmall, fontWeight: 500 }}>
          <span style={{ fontSize: 9, marginRight: 6, transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
          {proj.name}
          {!isAbandoned && <span style={badgeStyle}>NOT ABANDONED</span>}
        </td>
        <td style={{ ...cellSmall, fontSize: 11 }}>
          {proj.abandonedReason ? (
            <div style={{ fontWeight: 500 }}>{proj.abandonedReason}</div>
          ) : null}
          {proj.abandonedRemarks ? (
            <div style={{ color: "var(--ink-tertiary)", fontSize: 10, marginTop: 2 }}>
              {proj.abandonedRemarks}
            </div>
          ) : null}
          {!proj.abandonedReason && !proj.abandonedRemarks ? (
            <span style={{ color: "var(--ink-tertiary)" }}>—</span>
          ) : null}
        </td>
        <td style={{ ...cellSmall, whiteSpace: "nowrap" }}>
          {proj.abandonedAt ? formatDate(proj.abandonedAt) : "—"}
        </td>
        <td style={cellActionSmall}>
          {isAbandoned ? (
            <button
              onClick={(e) => { e.stopPropagation(); onUnabandon("project", proj.id, proj.name, [{ type: "Program", name: progName }]); }}
              disabled={loading === proj.id}
              style={{ ...btnSmall, opacity: loading === proj.id ? 0.5 : 1 }}
            >
              {loading === proj.id ? "..." : "Unabandon"}
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && proj.tasks.map((task) => (
        <tr key={`task-${task.id}`}>
          <td style={{ ...cellNested, paddingLeft: 56, color: "var(--ink-tertiary)" }}>
            {task.code}
          </td>
          <td style={cellNested}></td>
          <td style={cellNested}>
            {task.name}
          </td>
          <td style={{ ...cellNested, fontSize: 11 }}>
            {task.abandonedReason ? (
              <div style={{ fontWeight: 500 }}>{task.abandonedReason}</div>
            ) : null}
            {task.abandonedRemarks ? (
              <div style={{ color: "var(--ink-tertiary)", fontSize: 10, marginTop: 2 }}>
                {task.abandonedRemarks}
              </div>
            ) : null}
            {!task.abandonedReason && !task.abandonedRemarks ? (
              <span style={{ color: "var(--ink-tertiary)" }}>—</span>
            ) : null}
          </td>
          <td style={{ ...cellNested, whiteSpace: "nowrap" }}>
            {task.abandonedAt ? formatDate(task.abandonedAt) : "—"}
          </td>
          <td style={{ ...cellNested, textAlign: "right" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onUnabandon(task.type, task.id, task.name, [{ type: "Project", name: proj.name }, { type: "Program", name: progName }]); }}
              disabled={loading === task.id}
              style={{ ...btnSmall, opacity: loading === task.id ? 0.5 : 1 }}
            >
              {loading === task.id ? "..." : "Unabandon"}
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}
