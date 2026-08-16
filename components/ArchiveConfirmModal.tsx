"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";

interface Counts {
  programs: number;
  projects: number;
  tasks: number;
  specialTasks: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entityType: "Framework" | "Program" | "Project" | "Task" | "SpecialTask";
  entityName: string;
  entityId: number;
  loading?: boolean;
}

export default function ArchiveConfirmModal({
  open,
  onClose,
  onConfirm,
  entityType,
  entityName,
  entityId,
  loading = false,
}: Props) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  useEffect(() => {
    if (open && entityType !== "Task") {
      setLoadingCounts(true);
      fetch("/api/archive-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId }),
      })
        .then((res) => res.json())
        .then((data) => setCounts(data))
        .catch(() => setCounts(null))
        .finally(() => setLoadingCounts(false));
    } else if (open) {
      setCounts(null);
    }
  }, [open, entityType, entityId]);

  const totalChildren =
    (counts?.programs ?? 0) + (counts?.projects ?? 0) + (counts?.tasks ?? 0) + (counts?.specialTasks ?? 0);
  const hasChildren = totalChildren > 0;

  return (
    <Modal open={open} onClose={onClose} title="Archive Item">
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8v13H3V8" />
              <path d="M1 3h22v5H1z" />
              <path d="M10 12h4" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)", margin: 0 }}>
              Archive {entityType}
            </p>
            <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: "4px 0 0" }}>
              You are about to archive <strong>{entityName}</strong>.
            </p>
          </div>
        </div>

        {entityType !== "Task" && (
          <div
            style={{
              background: "var(--ground)",
              borderRadius: 4,
              padding: "12px 16px",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-primary)", margin: "0 0 8px" }}>
              This will also archive:
            </p>
            {loadingCounts ? (
              <p style={{ fontSize: 12, color: "var(--ink-tertiary)", margin: 0 }}>Loading...</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, color: "var(--ink-secondary)" }}>
                {entityType === "Framework" && counts && counts.programs > 0 && (
                  <li style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{counts.programs}</span> program{counts.programs !== 1 ? "s" : ""}
                  </li>
                )}
                {(entityType === "Framework" || entityType === "Program") && counts && counts.projects > 0 && (
                  <li style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{counts.projects}</span> project{counts.projects !== 1 ? "s" : ""}
                  </li>
                )}
                {counts && counts.tasks > 0 && (
                  <li>
                    <span style={{ fontWeight: 600 }}>{counts.tasks}</span> task{counts.tasks !== 1 ? "s" : ""}
                  </li>
                )}
                {counts && counts.specialTasks > 0 && (
                  <li>
                    <span style={{ fontWeight: 600 }}>{counts.specialTasks}</span> special task{counts.specialTasks !== 1 ? "s" : ""}
                  </li>
                )}
                {!loadingCounts && !hasChildren && (
                  <li style={{ color: "var(--ink-tertiary)" }}>No child items</li>
                )}
              </ul>
            )}
          </div>
        )}

        {entityType === "Task" && (
          <p style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 16 }}>
            This task will be moved to the archive and hidden from the dashboard.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-primary)",
              background: "var(--surface)",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || loadingCounts}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "#FFFFFF",
              background: "#B91C1C",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              opacity: loading || loadingCounts ? 0.5 : 1,
            }}
          >
            {loading ? "Archiving..." : "Archive"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
