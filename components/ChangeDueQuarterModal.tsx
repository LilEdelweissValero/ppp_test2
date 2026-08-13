"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import QuarterSelect from "./QuarterSelect";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { entityType: "Project" | "Task"; entityId: number; newQuarter: string }) => void;
  entityType: "Project" | "Task";
  entityId: number;
  currentQuarter: string;
}

export default function ChangeDueQuarterModal({
  open,
  onClose,
  onSave,
  entityType,
  entityId,
  currentQuarter,
}: Props) {
  const [newQuarter, setNewQuarter] = useState("");
  const [remarks, setRemarks] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setNewQuarter("");
      setRemarks("");
      setServerError("");
      setSubmitted(false);
    }
  }, [open]);

  const quarterInvalid = submitted && !newQuarter;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError("");

    if (!newQuarter) return;

    setLoading(true);

    try {
      const url =
        entityType === "Project"
          ? `/api/projects/${entityId}/change-quarter`
          : `/api/tasks/${entityId}/change-quarter`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newQuarter, remarks }),
      });

      if (res.ok) {
        onSave({ entityType, entityId, newQuarter });
        onClose();
      } else {
        const data = await res.json();
        setServerError(data.error || "Failed to change quarter");
      }
    } catch {
      setServerError("Failed to change quarter");
    } finally {
      setLoading(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--ink-secondary)",
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--rule-strong)",
    borderRadius: 3,
    padding: "7px 12px",
    fontSize: 12,
    color: "var(--ink-primary)",
    background: "var(--surface)",
  };

  const disabledInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: "var(--ground)",
    color: "var(--ink-secondary)",
    cursor: "not-allowed",
  };

  const cancelBtnStyle: React.CSSProperties = {
    padding: "7px 16px",
    fontSize: 12,
    color: "var(--ink-primary)",
    background: "var(--ground)",
    border: "1px solid var(--rule-strong)",
    borderRadius: 3,
    cursor: "pointer",
  };

  const saveBtnStyle: React.CSSProperties = {
    padding: "7px 16px",
    fontSize: 12,
    fontWeight: 600,
    color: "#FFFFFF",
    background: "var(--accent)",
    border: "none",
    borderRadius: 3,
    cursor: "pointer",
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Due Quarter">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Current Quarter Due</label>
          <input
            type="text"
            value={currentQuarter}
            disabled
            style={disabledInputStyle}
          />
        </div>

        <QuarterSelect
          label="New Quarter *"
          value={newQuarter}
          onChange={setNewQuarter}
          invalid={quarterInvalid}
        />

        <div>
          <label style={labelStyle}>Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {serverError && <p style={{ fontSize: 12, color: "#B91C1C" }}>{serverError}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={cancelBtnStyle}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ ...saveBtnStyle, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
