"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, remarks: string) => void;
  entityType: "Program" | "Project" | "Task" | "SpecialTask";
  entityName: string;
  entityId: number;
  reasons: string[];
  loading?: boolean;
}

export default function AbandonConfirmModal({
  open,
  onClose,
  onConfirm,
  entityType,
  entityName,
  reasons,
  loading = false,
}: Props) {
  const [selectedReason, setSelectedReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedReason("");
      setRemarks("");
      setExpanded(false);
    }
  }, [open]);

  const canConfirm = selectedReason.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Abandon Item">
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)", margin: 0 }}>
              Abandon {entityType}
            </p>
            <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: "4px 0 0" }}>
              You&apos;re about to abandon <strong>{entityName}</strong>.
            </p>
          </div>
        </div>

        {(entityType === "Program" || entityType === "Project") && (
          <div
            style={{
              background: "var(--ground)",
              borderRadius: 4,
              padding: "12px 16px",
              marginBottom: 16,
              cursor: "pointer",
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-primary)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
              This will also abandon all child {entityType === "Program" ? "projects and tasks" : "tasks"}
            </p>
            {expanded && (
              <p style={{ fontSize: 11, color: "var(--ink-tertiary)", margin: "8px 0 0" }}>
                All nested items will be marked as abandoned and excluded from health calculations.
              </p>
            )}
          </div>
        )}

        {entityType === "Task" && (
          <p style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 16 }}>
            This task will be marked as abandoned and excluded from health calculations.
          </p>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-primary)", marginBottom: 6 }}>
            Reason <span style={{ color: "#B91C1C" }}>*</span>
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              padding: "8px 12px",
              fontSize: 12,
              outline: "none",
              background: "var(--surface)",
            }}
          >
            <option value="">Select a reason…</option>
            {reasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-primary)", marginBottom: 6 }}>
            Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional additional context…"
            rows={3}
            style={{
              width: "100%",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              padding: "8px 12px",
              fontSize: 12,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

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
            onClick={() => onConfirm(selectedReason, remarks)}
            disabled={loading || !canConfirm}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "#FFFFFF",
              background: canConfirm ? "#B91C1C" : "#9CA3AF",
              border: "none",
              borderRadius: 3,
              cursor: canConfirm ? "pointer" : "default",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Abandoning…" : "Abandon"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
