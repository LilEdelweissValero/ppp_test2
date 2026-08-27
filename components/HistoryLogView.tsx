"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function HistoryLogView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [changeFilter, setChangeFilter] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  useEffect(() => {
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
  }, [page, entityFilter, changeFilter]);

  function handleSort(key: string) {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: key === "createdAt" ? "desc" : "asc" };
    });
  }

  const sortedLogs = useMemo(() => {
    if (!sortConfig) return logs;
    return [...logs].sort((a, b) => {
      const va = a[sortConfig.key as keyof LogEntry];
      const vb = b[sortConfig.key as keyof LogEntry];
      let cmp: number;
      if (sortConfig.key === "createdAt") {
        cmp = new Date(va as string).getTime() - new Date(vb as string).getTime();
      } else {
        cmp = String(va ?? "").localeCompare(String(vb ?? ""));
      }
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [logs, sortConfig]);

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

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink-secondary)",
    borderBottom: "2px solid var(--rule-strong)",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  };

  const tdStyle: React.CSSProperties = {
    padding: "7px 12px",
    fontSize: 12,
    color: "var(--ink-primary)",
    borderBottom: "1px solid var(--rule)",
    verticalAlign: "top",
  };

  const badgeStyle = (bg: string, ink: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 3,
    background: bg,
    color: ink,
    whiteSpace: "nowrap",
  });

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
          <option value="Phase">Phase</option>
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
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ground)" }}>
                  {[
                    { label: "Date", key: "createdAt" },
                    { label: "Action", key: "changeType" },
                    { label: "Entity", key: "entityType" },
                    { label: "Name", key: "entityName" },
                    { label: "Details", key: "details" },
                  ].map(({ label, key }) => {
                    const active = sortConfig?.key === key;
                    const arrow = active
                      ? sortConfig!.direction === "asc"
                        ? " \u25B2"
                        : " \u25BC"
                      : "";
                    return (
                      <th
                        key={key}
                        style={thStyle}
                        onClick={() => handleSort(key)}
                      >
                        {label}
                        {arrow && (
                          <span style={{ fontSize: 7, marginLeft: 2, opacity: active ? 1 : 0.3 }}>
                            {arrow}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map((log, i) => {
                  const style = getStyle(log.changeType);
                  return (
                    <tr
                      key={log.id}
                      style={{
                        background: i % 2 === 0 ? "var(--surface)" : "var(--ground)",
                      }}
                    >
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "var(--ink-tertiary)" }}>
                        {formatDate(log.createdAt)}
                      </td>
                      <td style={tdStyle}>
                        <span style={badgeStyle(style.bg, style.ink)}>
                          {style.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        {log.entityType}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>
                        {log.entityName || `${log.entityType} #${log.entityId}`}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink-secondary)" }}>
                        {log.changeType === "settings"
                          ? log.details
                          : log.details || (
                              <>
                                {log.oldValue && log.newValue && (
                                  <span>{log.oldValue} &rarr; {log.newValue}</span>
                                )}
                                {!log.oldValue && log.newValue && (
                                  <span>{log.newValue}</span>
                                )}
                              </>
                            )}
                        {log.remarks && (
                          <span style={{ fontStyle: "italic", marginLeft: 4 }}>
                            ({log.remarks})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
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
  );
}
