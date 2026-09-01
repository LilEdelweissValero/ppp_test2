"use client";

import { useEffect } from "react";
import Modal from "./Modal";

interface ParentInfo {
  type: "Project" | "Program";
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entityType: "task" | "special-task" | "project";
  entityName: string;
  parentsToUnabandon: ParentInfo[];
  loading?: boolean;
}

export default function UnabandonConfirmModal({
  open,
  onClose,
  onConfirm,
  entityType,
  entityName,
  parentsToUnabandon,
  loading = false,
}: Props) {
  useEffect(() => {
    if (open) {
      // no state to reset — no form fields
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Unabandon Item">
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#DBEAFE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>
              Unabandon {entityType === "project" ? "Project" : entityType === "task" ? "Task" : "Special Task"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-secondary)" }}>
              You&apos;re about to un-abandon <strong>{entityName}</strong>.
            </p>
          </div>
        </div>

        {parentsToUnabandon.length > 0 && (
          <div
            style={{
              padding: "12px 14px",
              marginBottom: 16,
              borderRadius: 4,
              background: "#FEF9C3",
              border: "1px solid #FDE68A",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 8 }}>
              This will also un-abandon the following items:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#78350F" }}>
              {parentsToUnabandon.map((p, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  <span style={{ fontWeight: 500 }}>{p.type}</span>: {p.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            borderTop: "1px solid var(--rule)",
            paddingTop: 16,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-secondary)",
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "#fff",
              background: "#2563EB",
              border: "none",
              borderRadius: 3,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Unabandoning..." : "Unabandon"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
