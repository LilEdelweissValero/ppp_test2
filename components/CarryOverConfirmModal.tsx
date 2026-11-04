"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { nextYear } from "@/lib/carry-over";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  entityType: "Project" | "Task" | "SpecialTask" | "SuchTask";
  entityName: string;
  loading?: boolean;
}

export default function CarryOverConfirmModal({
  open,
  onClose,
  onConfirm,
  entityType,
  entityName,
  loading = false,
}: Props) {
  const [remarks, setRemarks] = useState("");
  const year = nextYear();
  const currentYear = String(Number(year) - 1);

  useEffect(() => {
    if (open) setRemarks("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={`Carry Over to ${year}`}>
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--status-partial-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-partial-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)", margin: 0 }}>
              Carry over {entityType === "Project" ? "project" : "task"} to {year}
            </p>
            <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: "4px 0 0" }}>
              You&apos;re about to carry over <strong>{entityName}</strong>.
            </p>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 16 }}>
          {entityType === "Project"
            ? `This also parks all of the project's tasks. `
            : ""}
          Parked items are excluded from {currentYear} calculations. Find them later in the Parking Lot.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-primary)", marginBottom: 6 }}>
            Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional context, e.g. waiting on vendor delivery…"
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
            onClick={() => onConfirm(remarks)}
            disabled={loading}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "#FFFFFF",
              background: "var(--status-partial-ink)",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Carrying over…" : `Carry over to ${year}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
