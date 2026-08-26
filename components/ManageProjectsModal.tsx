"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";

interface ProjectRow {
  id: number;
  name: string;
  reference: string | null;
  owner: string | null;
  programName: string;
  frameworkName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projects: ProjectRow[];
  onChangeLevel: (ids: number[]) => void;
}

export default function ManageProjectsModal({ open, onClose, projects, onChangeLevel }: Props) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIds(new Set());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.reference ?? "").toLowerCase().includes(q) ||
        (p.owner ?? "").toLowerCase().includes(q) ||
        p.programName.toLowerCase().includes(q) ||
        p.frameworkName.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Projects" wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            style={{
              flex: 1,
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              padding: "8px 12px",
              fontSize: 12,
              outline: "none",
            }}
          />
          {selectedIds.size > 0 && (
            <button
              onClick={() => onChangeLevel([...selectedIds])}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                background: "var(--accent)",
                borderRadius: 3,
                cursor: "pointer",
                border: "none",
                flexShrink: 0,
              }}
            >
              Change Level…
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            color: "var(--ink-tertiary)",
          }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={filtered.length === 0}
            style={{ accentColor: "var(--accent)", cursor: "pointer" }}
            aria-label="Select all projects"
          />
          <span>Select all</span>
          {selectedIds.size > 0 && (
            <span style={{ marginLeft: "auto" }}>{selectedIds.size} selected</span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--ink-tertiary)", textAlign: "center", padding: "24px 0" }}>
              {search ? "No projects match your search." : "No projects yet."}
            </p>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid var(--rule)",
                borderRadius: 3,
                padding: "8px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                  aria-label={`Select ${p.name} for level change`}
                />
                <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </span>
                {p.reference && (
                  <span style={{ fontSize: 10, color: "var(--ink-tertiary)" }}>{p.reference}</span>
                )}
              </div>
              <span style={{ fontSize: 10, color: "var(--ink-tertiary)", flexShrink: 0, marginLeft: 12 }}>
                {p.programName} · {p.frameworkName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
