"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

interface LogEntry {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  remarks: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const CHANGE_TYPE_STYLES: Record<string, { bg: string; ink: string; label: string }> = {
  create: { bg: "#E6F4EE", ink: "#1A6B3C", label: "ADD" },
  update: { bg: "var(--accent-bg)", ink: "var(--accent)", label: "MODIFY" },
  delete: { bg: "#FFF0EE", ink: "#B91C1C", label: "DELETE" },
  import: { bg: "#F3E8FF", ink: "#7C3AED", label: "IMPORT" },
  quarter: { bg: "#FFF3E0", ink: "#8B5200", label: "QUARTER" },
  status: { bg: "#EAF1FE", ink: "#1D4BAA", label: "STATUS" },
  settings: { bg: "#FFF8E1", ink: "#8B6914", label: "SETTINGS" },
  reorder: { bg: "#E8F5E9", ink: "#2E7D32", label: "REORDER" },
};

export default function HistoryLogModal({ open, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [changeFilter, setChangeFilter] = useState("");

  useEffect(() => {
    if (open) {
      setPage(1);
      setEntityFilter("");
      setChangeFilter("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (entityFilter) params.set("entityType", entityFilter);
    if (changeFilter) params.set("changeType", changeFilter);

    fetch(`/api/change-history/all?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs);
        setTotalPages(data.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, page, entityFilter, changeFilter]);

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

  function getStyle(changeType: string) {
    return (
      CHANGE_TYPE_STYLES[changeType] || {
        bg: "var(--ground)",
        ink: "var(--ink-primary)",
        label: changeType.toUpperCase(),
      }
    );
  }

  const filterSelectStyle: React.CSSProperties = {
    border: "1px solid var(--rule)",
    borderRadius: 3,
    padding: "5px 8px",
    fontSize: 12,
    color: "var(--ink-primary)",
    background: "var(--surface)",
  };

  const badgeStyle = (bg: string, ink: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 3,
    background: bg,
    color: ink,
  });

  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--rule)",
    borderRadius: 3,
    padding: 12,
    fontSize: 12,
  };

  const paginationBtnStyle: React.CSSProperties = {
    padding: "4px 12px",
    fontSize: 11,
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--surface)",
    color: "var(--ink-primary)",
    cursor: "pointer",
  };

  return (
    <Modal open={open} onClose={onClose} title="History Log">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            style={filterSelectStyle}
          >
            <option value="">All Entity Types</option>
            <option value="Framework">Framework</option>
            <option value="Program">Program</option>
            <option value="Project">Project</option>
            <option value="Task">Task</option>
            <option value="Settings">Settings</option>
            <option value="Import">Import</option>
          </select>
          <select
            value={changeFilter}
            onChange={(e) => {
              setChangeFilter(e.target.value);
              setPage(1);
            }}
            style={filterSelectStyle}
          >
            <option value="">All Actions</option>
            <option value="create">Add</option>
            <option value="update">Modify</option>
            <option value="delete">Delete</option>
            <option value="import">Import</option>
            <option value="quarter">Quarter Change</option>
            <option value="status">Status Change</option>
            <option value="settings">Settings Change</option>
            <option value="reorder">Reorder</option>
          </select>
        </div>

        {loading ? (
          <p style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Loading...</p>
        ) : logs.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-secondary)" }}>No history records found.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 384, overflowY: "auto" }}>
              {logs.map((log) => {
                const style = getStyle(log.changeType);
                return (
                  <div key={log.id} style={cardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={badgeStyle(style.bg, style.ink)}>
                        {style.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-secondary)" }}>
                        {log.entityType}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 500, color: "var(--ink-primary)" }}>
                      {log.entityName || `${log.entityType} #${log.entityId}`}
                    </div>
                    {log.oldValue && log.newValue && (
                      <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 4 }}>
                        {log.oldValue} &rarr; {log.newValue}
                      </div>
                    )}
                    {!log.oldValue && log.newValue && (
                      <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 4 }}>
                        {log.newValue}
                      </div>
                    )}
                    {log.details && (
                      <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 4 }}>
                        {log.details}
                      </div>
                    )}
                    {log.remarks && (
                      <p style={{ marginTop: 4, fontSize: 11, color: "var(--ink-secondary)", fontStyle: "italic" }}>
                        {log.remarks}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, paddingTop: 8 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ ...paginationBtnStyle, opacity: page === 1 ? 0.4 : 1 }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ ...paginationBtnStyle, opacity: page === totalPages ? 0.4 : 1 }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
