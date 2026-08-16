"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

interface LogEntry {
  id: number;
  changeType: string;
  entityName: string;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  remarks: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: "Project" | "Task" | "SpecialTask";
  entityId: number;
}

export default function ChangeHistoryModal({
  open,
  onClose,
  entityType,
  entityId,
}: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`/api/change-history?entityType=${entityType}&entityId=${entityId}`)
        .then((res) => res.json())
        .then((data) => {
          setLogs(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, entityType, entityId]);

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

  const changeTypeLabel: Record<string, { bg: string; ink: string; label: string }> = {
    status: { bg: "#F3E8FF", ink: "#7C3AED", label: "Status" },
    quarter: { bg: "#FFF3E0", ink: "#8B5200", label: "Quarter" },
    quarter_change: { bg: "#FFF3E0", ink: "#8B5200", label: "Quarter" },
    create: { bg: "#E6F4EE", ink: "#1A6B3C", label: "Created" },
    update: { bg: "var(--accent-bg)", ink: "var(--accent)", label: "Updated" },
    delete: { bg: "#FFF0EE", ink: "#B91C1C", label: "Deleted" },
    import: { bg: "#E0F2FE", ink: "#0369A1", label: "Import" },
  };

  const badgeStyle = (bg: string, ink: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 10,
    background: bg,
    color: ink,
  });

  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--rule)",
    borderRadius: 3,
    padding: 12,
    fontSize: 12,
  };

  return (
    <Modal open={open} onClose={onClose} title="Change History">
      {loading ? (
        <p style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Loading...</p>
      ) : logs.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ink-secondary)" }}>No changes recorded.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {logs.map((log) => {
            const ct = changeTypeLabel[log.changeType] || {
              bg: "var(--ground)",
              ink: "var(--ink-primary)",
              label: log.changeType,
            };
            return (
              <div key={log.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={badgeStyle(ct.bg, ct.ink)}>
                    {ct.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                    {formatDate(log.createdAt)}
                  </span>
                </div>
                {log.oldValue && log.newValue && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>{log.oldValue}</span>
                    <span style={{ color: "var(--ink-tertiary)" }}>&rarr;</span>
                    <span style={{ fontWeight: 500 }}>{log.newValue}</span>
                  </div>
                )}
                {!log.oldValue && log.newValue && (
                  <div style={{ fontWeight: 500 }}>{log.newValue}</div>
                )}
                {log.details && (
                  <p style={{ marginTop: 4, fontSize: 11, color: "var(--ink-secondary)" }}>{log.details}</p>
                )}
                {log.remarks && (
                  <p style={{ marginTop: 4, fontSize: 11, color: "var(--ink-secondary)", fontStyle: "italic" }}>{log.remarks}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
