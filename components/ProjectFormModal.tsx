"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import QuarterSelect from "./QuarterSelect";

interface Framework {
  id: number;
  name: string;
  color: string;
  programs: { id: number; name: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (project: { id: number; name: string; programId: number; reference: string | null; owner: string | null; targetQuarter: string; adjustedTargetQuarter: string; actualCompletionDate: string | null; sortOrder: number; program?: { id: number; name: string } }) => void;
  frameworkId?: number | null;
  initialData?: {
    id: number;
    name: string;
    programId: number;
    reference: string;
    owner: string;
    targetQuarter: string;
    actualCompletionDate: string;
  };
}

export default function ProjectFormModal({
  open,
  onClose,
  onSave,
  frameworkId,
  initialData,
}: Props) {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [selectedFrameworkId, setSelectedFrameworkId] = useState(
    initialData?.programId ? 0 : frameworkId || 0
  );
  const [selectedProgramId, setSelectedProgramId] = useState(
    initialData?.programId || 0
  );
  const [reference, setReference] = useState(initialData?.reference || "");
  const [owner, setOwner] = useState(initialData?.owner || "");
  const [targetQuarter, setTargetQuarter] = useState(
    initialData?.targetQuarter || ""
  );
  const [actualCompletionDate, setActualCompletionDate] = useState(
    initialData?.actualCompletionDate || ""
  );
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const filteredPrograms =
    selectedFrameworkId > 0
      ? frameworks.find((f) => f.id === selectedFrameworkId)?.programs || []
      : frameworks.flatMap((f) => f.programs);

  async function loadFrameworks() {
    const res = await fetch("/api/frameworks");
    if (res.ok) {
      const data = await res.json();
      setFrameworks(data);
    }
  }

  useEffect(() => {
    if (open) {
      loadFrameworks();
      if (!isEdit) {
        setName("");
        setSelectedFrameworkId(frameworkId || 0);
        setSelectedProgramId(0);
        setReference("");
        setOwner("");
        setTargetQuarter("");
        setActualCompletionDate("");
      }
      setServerError("");
      setSubmitted(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (selectedFrameworkId > 0 && !isEdit) {
      setSelectedProgramId(0);
    }
  }, [selectedFrameworkId, isEdit]);

  const nameInvalid = submitted && !name.trim();
  const frameworkInvalid = submitted && !isEdit && !frameworkId && selectedFrameworkId === 0;
  const programInvalid = submitted && !isEdit && !frameworkId && selectedProgramId === 0;
  const quarterInvalid = submitted && !targetQuarter;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError("");

    if (!name.trim() || !targetQuarter) {
      return;
    }
    if (!frameworkId && !isEdit && selectedFrameworkId === 0) {
      return;
    }
    if (!frameworkId && !isEdit && selectedProgramId === 0) {
      return;
    }

    setLoading(true);

    const url = isEdit
      ? `/api/projects/${initialData?.id}`
      : "/api/projects";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        programId: selectedProgramId,
        reference,
        owner,
        targetQuarter,
        actualCompletionDate: actualCompletionDate || null,
      }),
    });

    setLoading(false);
    if (res.ok) {
      const project = await res.json();
      onSave(project);
      onClose();
    } else {
      const data = await res.json();
      setServerError(data.error || "Failed to save project");
    }
  }

  const inputStyle = (invalid: boolean): React.CSSProperties => ({
    width: "100%",
    border: `1px solid ${invalid ? "#B91C1C" : "var(--rule-strong)"}`,
    borderRadius: 3,
    padding: "6px 10px",
    fontSize: 12,
    color: "var(--ink-primary)",
    background: "var(--surface)",
    outline: "none",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--ink-secondary)",
    marginBottom: 4,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Project" : "Add Project"}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle(nameInvalid)}
          />
        </div>

        {!frameworkId && !isEdit && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Framework *</label>
            <select
              value={selectedFrameworkId}
              onChange={(e) => setSelectedFrameworkId(parseInt(e.target.value))}
              style={inputStyle(frameworkInvalid)}
            >
              <option value={0}>Select framework</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!frameworkId && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Program *</label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(parseInt(e.target.value))}
              style={inputStyle(programInvalid)}
              disabled={selectedFrameworkId === 0}
            >
              <option value={0}>Select program</option>
              {filteredPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              style={inputStyle(false)}
            />
          </div>
          <div>
            <label style={labelStyle}>Owner</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              style={inputStyle(false)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <QuarterSelect
            label="Target Quarter *"
            value={targetQuarter}
            onChange={setTargetQuarter}
            invalid={quarterInvalid}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Actual Completion Date</label>
          <input
            type="date"
            value={actualCompletionDate}
            onChange={(e) => setActualCompletionDate(e.target.value)}
            style={inputStyle(false)}
          />
        </div>

        {serverError && (
          <p style={{ fontSize: 12, color: "#B91C1C", marginBottom: 12 }}>
            {serverError}
          </p>
        )}

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 12,
          borderTop: "1px solid var(--rule)",
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-primary)",
              background: "var(--ground)",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "#FFFFFF",
              background: "var(--accent)",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
