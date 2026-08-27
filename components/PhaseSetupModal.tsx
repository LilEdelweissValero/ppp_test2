"use client";

import { useState } from "react";
import Modal from "./Modal";
import type { CachedTask, CachedSpecialTask } from "./PortfolioCacheProvider";

interface PhaseEntry {
  name: string;
  weight: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  tasks: CachedTask[];
  specialTasks: CachedSpecialTask[];
  onSaved: (phases: { id: number; name: string; weight: number; sortOrder: number }[], updatedTasks: CachedTask[], updatedSpecialTasks: CachedSpecialTask[]) => void;
}

export default function PhaseSetupModal({
  open,
  onClose,
  projectId,
  tasks,
  specialTasks,
  onSaved,
}: Props) {
  const [phases, setPhases] = useState<PhaseEntry[]>([
    { name: "", weight: 50 },
    { name: "", weight: 50 },
  ]);
  const [taskPhaseMap, setTaskPhaseMap] = useState<Record<number, string>>({});
  const [specialTaskPhaseMap, setSpecialTaskPhaseMap] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);
  const weightValid = Math.abs(totalWeight - 100) < 0.01;

  function updatePhase(index: number, field: keyof PhaseEntry, value: string | number) {
    if (field === "name") {
      const oldName = phases[index].name;
      const newName = value as string;
      setTaskPhaseMap((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === oldName) next[k] = newName;
        }
        return next;
      });
      setSpecialTaskPhaseMap((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === oldName) next[k] = newName;
        }
        return next;
      });
    }
    setPhases((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function addPhase() {
    setPhases((prev) => [...prev, { name: "", weight: 0 }]);
  }

  function removePhase(index: number) {
    if (phases.length <= 1) return;
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!weightValid) {
      setError(`Phase weights must sum to 100%. Current total: ${totalWeight}%`);
      return;
    }
    if (phases.some((p) => !p.name.trim())) {
      setError("All phases must have a name.");
      return;
    }
    if (unassignedTasks.length > 0 || unassignedSpecialTasks.length > 0) {
      setError("All tasks must be assigned to a phase.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create phases
      const res = await fetch("/api/phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          phases: phases.map((p) => ({ name: p.name.trim(), weight: p.weight })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create phases");
      }
      const createdPhases = await res.json();

      // Assign tasks to phases
      const taskUpdates: Promise<Response>[] = [];
      for (const [taskIdStr, phaseName] of Object.entries(taskPhaseMap)) {
        const phase = createdPhases.find((p: { name: string }) => p.name === phaseName);
        if (phase) {
          taskUpdates.push(
            fetch(`/api/tasks/${taskIdStr}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phaseId: phase.id }),
            })
          );
        }
      }
      for (const [stIdStr, phaseName] of Object.entries(specialTaskPhaseMap)) {
        const phase = createdPhases.find((p: { name: string }) => p.name === phaseName);
        if (phase) {
          taskUpdates.push(
            fetch(`/api/special-tasks/${stIdStr}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phaseId: phase.id }),
            })
          );
        }
      }
      await Promise.all(taskUpdates);

      // Build updated tasks/specialTasks with phaseId
      const updatedTasks = tasks.map((t) => {
        const phaseName = taskPhaseMap[t.id];
        if (phaseName) {
          const phase = createdPhases.find((p: { name: string }) => p.name === phaseName);
          return phase ? { ...t, phaseId: phase.id } : t;
        }
        return t;
      });
      const updatedSpecialTasks = specialTasks.map((st) => {
        const phaseName = specialTaskPhaseMap[st.id];
        if (phaseName) {
          const phase = createdPhases.find((p: { name: string }) => p.name === phaseName);
          return phase ? { ...st, phaseId: phase.id } : st;
        }
        return st;
      });

      onSaved(createdPhases, updatedTasks, updatedSpecialTasks);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const unassignedTasks = tasks.filter((t) => !taskPhaseMap[t.id]);
  const unassignedSpecialTasks = specialTasks.filter((st) => !specialTaskPhaseMap[st.id]);

  return (
    <Modal open={open} onClose={onClose} title="Set Up Phases" wide>
      <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginBottom: 16 }}>
        Create phases for this project and assign existing tasks. Weights must sum to 100%.
      </p>

      {/* Phase definitions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>Phases</span>
          <button
            onClick={addPhase}
            style={{
              fontSize: 12,
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

        {phases.map((phase, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <input
              placeholder="Phase name"
              value={phase.name}
              onChange={(e) => updatePhase(i, "name", e.target.value)}
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: 13,
                border: "1px solid var(--rule)",
                borderRadius: 3,
                background: "var(--surface)",
                color: "var(--ink-primary)",
              }}
            />
            <input
              type="number"
              placeholder="%"
              value={phase.weight || ""}
              onChange={(e) => updatePhase(i, "weight", parseFloat(e.target.value) || 0)}
              style={{
                width: 70,
                padding: "6px 10px",
                fontSize: 13,
                border: "1px solid var(--rule)",
                borderRadius: 3,
                background: "var(--surface)",
                color: "var(--ink-primary)",
                textAlign: "right",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>%</span>
            {phases.length > 1 && (
              <button
                onClick={() => removePhase(i)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-tertiary)",
                  cursor: "pointer",
                  fontSize: 16,
                  padding: "0 4px",
                }}
              >
                &times;
              </button>
            )}
          </div>
        ))}

        <div style={{
          fontSize: 12,
          color: weightValid ? "#1A6B3C" : "var(--ink-tertiary)",
          marginTop: 4,
          fontWeight: weightValid ? 600 : 400,
        }}>
          Total: {totalWeight}% {weightValid ? "✓" : `(must be 100%)`}
        </div>
      </div>

      {/* Task assignment */}
      {(tasks.length > 0 || specialTasks.length > 0) && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)", marginBottom: 8 }}>
            Assign Tasks to Phases (required)
          </div>

          {tasks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--ink-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Regular Tasks
              </div>
              {tasks.map((task) => (
                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-secondary)", fontFamily: "var(--font-mono)", minWidth: 70 }}>
                    {task.taskCode}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {task.name}
                  </span>
                  <select
                    value={taskPhaseMap[task.id] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskPhaseMap((prev) => {
                        const next = { ...prev };
                        if (val) next[task.id] = val;
                        else delete next[task.id];
                        return next;
                      });
                    }}
                    style={{
                      fontSize: 12,
                      padding: "3px 6px",
                      border: "1px solid var(--rule)",
                      borderRadius: 3,
                      background: "var(--surface)",
                      color: "var(--ink-primary)",
                    }}
                  >
                    <option value="">-- Select phase --</option>
                    {phases.filter((p) => p.name.trim()).map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {specialTasks.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Special Tasks
              </div>
              {specialTasks.map((st) => (
                <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-secondary)", fontFamily: "var(--font-mono)", minWidth: 70 }}>
                    {st.specialTaskCode}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {st.name}
                  </span>
                  <select
                    value={specialTaskPhaseMap[st.id] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSpecialTaskPhaseMap((prev) => {
                        const next = { ...prev };
                        if (val) next[st.id] = val;
                        else delete next[st.id];
                        return next;
                      });
                    }}
                    style={{
                      fontSize: 12,
                      padding: "3px 6px",
                      border: "1px solid var(--rule)",
                      borderRadius: 3,
                      background: "var(--surface)",
                      color: "var(--ink-primary)",
                    }}
                  >
                    <option value="">-- Select phase --</option>
                    {phases.filter((p) => p.name.trim()).map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tasks.length === 0 && specialTasks.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--ink-tertiary)", fontStyle: "italic", marginBottom: 16 }}>
          No tasks in this project yet. Tasks created later can be assigned to phases.
        </p>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "#C0392B", marginTop: 8 }}>{error}</p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
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
          disabled={saving || !weightValid || unassignedTasks.length > 0 || unassignedSpecialTasks.length > 0}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            border: "none",
            borderRadius: 3,
            background: saving || !weightValid || unassignedTasks.length > 0 || unassignedSpecialTasks.length > 0 ? "var(--ink-tertiary)" : "var(--accent)",
            color: "#fff",
            cursor: saving || !weightValid || unassignedTasks.length > 0 || unassignedSpecialTasks.length > 0 ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {saving ? "Saving…" : "Create Phases"}
        </button>
      </div>
    </Modal>
  );
}
