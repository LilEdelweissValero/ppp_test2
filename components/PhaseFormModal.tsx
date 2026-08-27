"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  initialData?: {
    id: number;
    name: string;
    weight: number;
  };
  onSaved: (phase: { id: number; name: string; weight: number; sortOrder: number }) => void;
}

export default function PhaseFormModal({
  open,
  onClose,
  projectId,
  initialData,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setWeight(initialData.weight);
    } else {
      setName("");
      setWeight(0);
    }
    setError(null);
  }, [initialData, open]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Phase name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEdit ? `/api/phases/${initialData!.id}` : "/api/phases";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name: name.trim(), weight }
        : { projectId, phases: [{ name: name.trim(), weight }] };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save phase");
      }

      const result = await res.json();
      const saved = isEdit ? result : result[0];
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Phase" : "Add Phase"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 4 }}>
            Phase Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Phase 1, Design Phase"
            autoFocus
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13,
              border: "1px solid var(--rule)",
              borderRadius: 3,
              background: "var(--surface)",
              color: "var(--ink-primary)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 4 }}>
            Weight (%)
          </label>
          <input
            type="number"
            value={weight || ""}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            min={0}
            max={100}
            step={0.01}
            style={{
              width: 120,
              padding: "8px 10px",
              fontSize: 13,
              border: "1px solid var(--rule)",
              borderRadius: 3,
              background: "var(--surface)",
              color: "var(--ink-primary)",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-tertiary)", marginLeft: 4 }}>%</span>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#C0392B", margin: 0 }}>{error}</p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              border: "1px solid var(--rule)",
              borderRadius: 3,
              background: "var(--surface)",
              color: "var(--ink-primary)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              border: "none",
              borderRadius: 3,
              background: saving || !name.trim() ? "var(--ink-tertiary)" : "var(--accent)",
              color: "#fff",
              cursor: saving || !name.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Phase"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
