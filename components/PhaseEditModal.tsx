"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "./Modal";

interface Phase {
  id: number;
  name: string;
  weight: number;
  sortOrder: number;
}

interface CachedTask {
  id: number;
  phaseId: number | null;
  status: string;
}

interface CachedSpecialTask {
  id: number;
  phaseId: number | null;
  total: number;
  nys: number;
  plan: number;
  part: number;
  mostly: number;
  done: number;
}

interface ComputationStatus {
  id: string;
  name: string;
  score: number;
}

interface ComputationSettings {
  statuses: ComputationStatus[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  currentTableName: string | null;
  phases: Phase[];
  tasks: CachedTask[];
  specialTasks: CachedSpecialTask[];
  compSettings: ComputationSettings;
  onSaved: (tableName: string, updatedPhases: Phase[]) => void;
}

function computeTaskPercentDone(status: string, statuses: ComputationStatus[]): number {
  const found = statuses.find((s) => s.name === status);
  return (found?.score ?? 0) / 100;
}

function computePhaseProgress(
  phaseId: number,
  tasks: CachedTask[],
  specialTasks: CachedSpecialTask[],
  compSettings: ComputationSettings
): number {
  const phaseTasks = tasks.filter((t) => t.phaseId === phaseId);
  const phaseSpecial = specialTasks.filter((st) => st.phaseId === phaseId);

  const virtualTasks = phaseSpecial.flatMap((st) => {
    const statuses = compSettings.statuses;
    const result: { status: string }[] = [];
    for (const [status, count] of [
      [statuses[0]?.name ?? "Not Yet Started", st.nys],
      [statuses[1]?.name ?? "In Progress, Planning or Initiated", st.plan],
      [statuses[2]?.name ?? "In Progress, Partial", st.part],
      [statuses[3]?.name ?? "In Progress, Mostly Done or Testing", st.mostly],
      [statuses[4]?.name ?? "Complete or Verified", st.done],
    ]) {
      for (let i = 0; i < count; i++) {
        result.push({ status });
      }
    }
    return result;
  });

  const allTasks = [...phaseTasks.map((t) => ({ status: t.status })), ...virtualTasks];
  if (allTasks.length === 0) return 0;
  const total = allTasks.reduce((s, t) => s + computeTaskPercentDone(t.status, compSettings.statuses), 0);
  return Math.round((total / allTasks.length) * 100);
}

export default function PhaseEditModal({
  open,
  onClose,
  projectId,
  currentTableName,
  phases,
  tasks,
  specialTasks,
  compSettings,
  onSaved,
}: Props) {
  const [tableName, setTableName] = useState(currentTableName || "Phases");
  const [editPhases, setEditPhases] = useState<{ id: number; name: string; weight: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTableName(currentTableName || "Phases");
      setEditPhases(phases.map((p) => ({ id: p.id, name: p.name, weight: p.weight })));
      setError(null);
    }
  }, [open, currentTableName, phases]);

  const totalWeight = useMemo(
    () => editPhases.reduce((s, p) => s + p.weight, 0),
    [editPhases]
  );

  const isValid = totalWeight === 100 && editPhases.every((p) => p.name.trim() !== "");

  function handleAddPhase() {
    setEditPhases([...editPhases, { id: -Date.now(), name: "", weight: 0 }]);
  }

  function handleRemovePhase(idx: number) {
    setEditPhases(editPhases.filter((_, i) => i !== idx));
  }

  function handlePhaseChange(idx: number, field: "name" | "weight", value: string | number) {
    setEditPhases(editPhases.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function handleSave() {
    if (!isValid) {
      if (totalWeight !== 100) {
        setError(`Total weight must equal 100% (currently ${totalWeight}%)`);
      } else {
        setError("All phase names are required.");
      }
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save table name if changed
      if (tableName !== (currentTableName || "Phases")) {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phasesTableName: tableName || null }),
        });
        if (!res.ok) throw new Error("Failed to save table name");
      }

      // Save existing phases (PATCH)
      const existingPhases = editPhases.filter((p) => p.id > 0);
      const newPhases = editPhases.filter((p) => p.id < 0);

      for (const phase of existingPhases) {
        const res = await fetch(`/api/phases/${phase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: phase.name.trim(), weight: phase.weight }),
        });
        if (!res.ok) throw new Error(`Failed to save phase "${phase.name}"`);
      }

      // Create new phases (POST)
      if (newPhases.length > 0) {
        const res = await fetch("/api/phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            phases: newPhases.map((p) => ({ name: p.name.trim(), weight: p.weight })),
          }),
        });
        if (!res.ok) throw new Error("Failed to create new phases");
      }

      // Fetch updated phases list
      const updatedProject = await fetch(`/api/projects/${projectId}`).then((r) => r.json());
      const savedTableName = updatedProject.phasesTableName || null;
      const savedPhases = updatedProject.phases || [];

      onSaved(savedTableName, savedPhases);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${tableName || "Phases"}`} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Table Name */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-secondary)",
              marginBottom: 4,
            }}
          >
            Table Name
          </label>
          <input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="e.g. Phases, Groups, Stages"
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

        {/* Phases List */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-secondary)",
              }}
            >
              Phases
            </label>
            <button
              onClick={handleAddPhase}
              style={{
                fontSize: 11,
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Add Phase
            </button>
          </div>

          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 60px 100px 40px",
              gap: 8,
              padding: "6px 0",
              borderBottom: "2px solid var(--rule-strong)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-tertiary)",
            }}
          >
            <span>Name</span>
            <span>Weight</span>
            <span style={{ textAlign: "center" }}>%</span>
            <span style={{ textAlign: "center" }}>Progress</span>
            <span />
          </div>

          {/* Rows */}
          {editPhases.map((phase, idx) => {
            const progress = phase.id > 0
              ? computePhaseProgress(phase.id, tasks, specialTasks, compSettings)
              : 0;

            return (
              <div
                key={phase.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 60px 100px 40px",
                  gap: 8,
                  padding: "6px 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "center",
                }}
              >
                <input
                  value={phase.name}
                  onChange={(e) => handlePhaseChange(idx, "name", e.target.value)}
                  placeholder="Phase name"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: 12,
                    border: "1px solid var(--rule)",
                    borderRadius: 3,
                    background: "var(--surface)",
                    color: "var(--ink-primary)",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="number"
                  value={phase.weight || ""}
                  onChange={(e) => handlePhaseChange(idx, "weight", parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  step={0.01}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: 12,
                    border: "1px solid var(--rule)",
                    borderRadius: 3,
                    background: "var(--surface)",
                    color: "var(--ink-primary)",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--ink-tertiary)", textAlign: "center" }}>%</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                  <div
                    style={{
                      width: 40,
                      height: 5,
                      background: "var(--rule)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: progress === 100 ? "#1A6B3C" : "#6366F1",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", color: "var(--ink-secondary)" }}>
                    {progress}%
                  </span>
                </div>
                <button
                  onClick={() => handleRemovePhase(idx)}
                  style={{
                    fontSize: 14,
                    color: "var(--ink-tertiary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    lineHeight: 1,
                  }}
                  title="Remove phase"
                >
                  &times;
                </button>
              </div>
            );
          })}

          {editPhases.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--ink-tertiary)", textAlign: "center", padding: 16 }}>
              No phases. Click &quot;+ Add Phase&quot; to create one.
            </p>
          )}
        </div>

        {/* Total Weight */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 0",
            borderTop: "2px solid var(--rule-strong)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span style={{ color: "var(--ink-secondary)" }}>Total Weight:</span>
          <span
            style={{
              color: totalWeight === 100 ? "#1A6B3C" : totalWeight > 100 ? "#C0392B" : "var(--ink-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalWeight}%{totalWeight === 100 ? " \u2713" : ""}
          </span>
        </div>

        {/* Error */}
        {error && (
          <p style={{ fontSize: 12, color: "#C0392B", margin: 0 }}>{error}</p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
            disabled={saving || !isValid}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              border: "none",
              borderRadius: 3,
              background: saving || !isValid ? "var(--ink-tertiary)" : "var(--accent)",
              color: "#fff",
              cursor: saving || !isValid ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {saving ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
