"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CarriedOverData, CarriedItem } from "@/lib/carried-over-data";
import Modal from "./Modal";
import QuarterSelect from "./QuarterSelect";

interface Props {
  data: CarriedOverData;
  canEdit: boolean;
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 600,
  color: "var(--ink-secondary)",
  borderBottom: "1px solid var(--rule)",
};

const td: React.CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid var(--rule)",
  fontSize: 12,
};

const btnPrimary: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 600,
  color: "#FFFFFF",
  background: "var(--accent)",
  border: "none",
  borderRadius: 3,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-primary)",
  background: "var(--surface)",
  border: "1px solid var(--rule-strong)",
  borderRadius: 3,
  cursor: "pointer",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function CarriedOverView({ data, canEdit }: Props) {
  const router = useRouter();
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pullOpen, setPullOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [quarter, setQuarter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => data.items.filter((i) => yearFilter === "ALL" || i.carriedOverTo === yearFilter),
    [data.items, yearFilter]
  );

  // Group by original project, keeping program context in the heading.
  const groups = useMemo(() => {
    const map = new Map<number, { projectName: string; programName: string; parked: boolean; items: CarriedItem[] }>();
    for (const item of visible) {
      const g = map.get(item.projectId) ?? {
        projectName: item.projectName,
        programName: item.programName,
        parked: item.projectParked,
        items: [],
      };
      g.items.push(item);
      map.set(item.projectId, g);
    }
    return [...map.entries()];
  }, [visible]);

  const selectedItems = visible.filter((i) => selected.has(i.key));
  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.key));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(items: CarriedItem[]) {
    const every = items.every((i) => selected.has(i.key));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of items) {
        if (every) next.delete(i.key);
        else next.add(i.key);
      }
      return next;
    });
  }

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/carried-over", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Something went wrong");
        return false;
      }
      setSelected(new Set());
      setPullOpen(false);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const refs = selectedItems.map((i) => ({ type: i.type, id: i.id }));
  const targetProject = data.targetProjects.find((p) => String(p.id) === targetProjectId);
  const canPull = !!targetProjectId && !!quarter && selectedItems.length > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-primary)", margin: 0 }}>
            Parking Lot
          </h1>
          <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: "4px 0 0" }}>
            {data.items.length} carried-over {data.items.length === 1 ? "item" : "items"}, excluded from current-year calculations.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {data.years.length > 1 && (
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Filter by target year"
              style={{ border: "1px solid var(--rule-strong)", borderRadius: 3, padding: "7px 12px", fontSize: 12, background: "var(--surface)" }}
            >
              <option value="ALL">All years</option>
              {data.years.map((y) => (
                <option key={y} value={y}>Carried to {y}</option>
              ))}
            </select>
          )}
          {canEdit && (
            <>
              <button
                style={{ ...btnSecondary, opacity: selectedItems.length === 0 || busy ? 0.5 : 1 }}
                disabled={selectedItems.length === 0 || busy}
                onClick={() => run({ action: "return", items: refs })}
                title="Move selected items back into the current year, in place"
              >
                Return to current year
              </button>
              <button
                style={{ ...btnPrimary, opacity: selectedItems.length === 0 ? 0.5 : 1 }}
                disabled={selectedItems.length === 0}
                onClick={() => {
                  setError(null);
                  setPullOpen(true);
                }}
              >
                Pull selected into project…{selectedItems.length > 0 ? ` (${selectedItems.length})` : ""}
              </button>
            </>
          )}
        </div>
      </div>

      {error && !pullOpen && (
        <p role="alert" style={{ fontSize: 12, color: "#B91C1C", marginBottom: 12 }}>{error}</p>
      )}

      {visible.length === 0 ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: 4,
            padding: "40px 24px",
            textAlign: "center",
            fontSize: 12,
            color: "var(--ink-tertiary)",
          }}
        >
          Nothing parked. Use “Carry over” on a task or project to park it here.
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 4 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {canEdit && (
                  <th style={{ ...th, width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((i) => i.key)))}
                      aria-label="Select all"
                      style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                    />
                  </th>
                )}
                <th style={th}>Code</th>
                <th style={th}>Name</th>
                <th style={th}>Original quarter</th>
                <th style={th}>Carried to</th>
                <th style={th}>Carried on</th>
                <th style={th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([projectId, g]) => (
                <GroupRows
                  key={projectId}
                  group={g}
                  canEdit={canEdit}
                  selected={selected}
                  onToggle={toggle}
                  onToggleGroup={toggleGroup}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={pullOpen} onClose={() => setPullOpen(false)} title="Pull into project">
        <div>
          <p style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 0 }}>
            Moves {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"} into the project you pick and sets
            their new quarter. Phase assignments are cleared; re-assign them in the new project.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)", marginBottom: 4 }}>
              Target project
            </label>
            <select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--rule-strong)", borderRadius: 3, padding: "7px 12px", fontSize: 12, background: "var(--surface)" }}
            >
              <option value="">Select a project…</option>
              {data.targetProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.programName}, {p.targetQuarter})
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: "var(--ink-tertiary)", margin: "4px 0 0" }}>
              Project not listed? Create it first under Actions → Manage Projects.
            </p>
          </div>

          <div style={{ marginBottom: 12 }}>
            <QuarterSelect label="New quarter" value={quarter} onChange={setQuarter} />
          </div>

          {canPull && targetProject && (
            <p style={{ fontSize: 12, color: "var(--ink-primary)", background: "var(--ground)", borderRadius: 4, padding: "8px 12px" }}>
              {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"} → <strong>{targetProject.name}</strong>, {quarter}
            </p>
          )}

          {error && <p role="alert" style={{ fontSize: 12, color: "#B91C1C" }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--rule)", paddingTop: 16, marginTop: 8 }}>
            <button style={btnSecondary} onClick={() => setPullOpen(false)} disabled={busy}>Cancel</button>
            <button
              style={{ ...btnPrimary, opacity: !canPull || busy ? 0.5 : 1 }}
              disabled={!canPull || busy}
              onClick={() => run({ action: "pull", items: refs, projectId: Number(targetProjectId), quarter })}
            >
              {busy ? "Pulling…" : "Pull in"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function GroupRows({
  group,
  canEdit,
  selected,
  onToggle,
  onToggleGroup,
}: {
  group: { projectName: string; programName: string; parked: boolean; items: CarriedItem[] };
  canEdit: boolean;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onToggleGroup: (items: CarriedItem[]) => void;
}) {
  const groupAll = group.items.every((i) => selected.has(i.key));
  const cols = canEdit ? 7 : 6;
  return (
    <>
      <tr style={{ background: "var(--ground)" }}>
        {canEdit && (
          <td style={{ ...td, padding: "6px 12px" }}>
            <input
              type="checkbox"
              checked={groupAll}
              onChange={() => onToggleGroup(group.items)}
              aria-label={`Select all items in ${group.projectName}`}
              style={{ accentColor: "var(--accent)", cursor: "pointer" }}
            />
          </td>
        )}
        <td colSpan={cols - (canEdit ? 1 : 0)} style={{ ...td, fontWeight: 600, color: "var(--ink-primary)" }}>
          {group.projectName}
          <span style={{ fontWeight: 400, color: "var(--ink-tertiary)", marginLeft: 8, fontSize: 11 }}>
            {group.programName}
            {group.parked ? " · whole project carried over" : ""}
          </span>
        </td>
      </tr>
      {group.items.map((i) => (
        <tr key={i.key}>
          {canEdit && (
            <td style={td}>
              <input
                type="checkbox"
                checked={selected.has(i.key)}
                onChange={() => onToggle(i.key)}
                aria-label={`Select ${i.code}`}
                style={{ accentColor: "var(--accent)", cursor: "pointer" }}
              />
            </td>
          )}
          <td style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-secondary)" }}>{i.code}</td>
          <td style={td}>{i.name}</td>
          <td style={{ ...td, whiteSpace: "nowrap" }}>{i.originalQuarter}</td>
          <td style={{ ...td, whiteSpace: "nowrap" }}>{i.carriedOverTo}</td>
          <td style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-tertiary)" }}>{formatDate(i.carriedOverAt)}</td>
          <td style={{ ...td, color: "var(--ink-secondary)" }}>{i.carriedOverRemarks ?? "—"}</td>
        </tr>
      ))}
    </>
  );
}
