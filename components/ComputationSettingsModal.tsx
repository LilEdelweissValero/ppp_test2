"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import {
  getDefaultSettings,
  QUARTER_CONDITIONS,
  PERCENT_CONDITIONS,
  generateMeaning,
  validateHealthRules,
} from "@/lib/computation-settings";
import type {
  ComputationSettings,
  ComputationStatus,
  HealthRule,
} from "@/lib/computation-settings";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "statuses" | "health" | "formulas" | "abandonment";

const TABS: { key: Tab; label: string }[] = [
  { key: "statuses", label: "Statuses" },
  { key: "health", label: "Health Criteria" },
  { key: "formulas", label: "Formulas" },
  { key: "abandonment", label: "Abandonment Reasons" },
];

// ── Statuses Tab ───────────────────────────────────────────────────────────

function StatusesTab({
  statuses,
  onChange,
}: {
  statuses: ComputationStatus[];
  onChange: (s: ComputationStatus[]) => void;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-secondary)",
          marginBottom: 16,
        }}
      >
        Edit the name and percentage score for each task status. Scores are used
        in completion rate calculations (0–100).
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr 100px",
          gap: "0",
          border: "1px solid var(--rule)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "32px 1fr 100px",
            background: "var(--ground-metric)",
            borderBottom: "1px solid var(--rule-strong)",
          }}
        >
          <div style={headerCellStyle}>#</div>
          <div style={headerCellStyle}>Status Name</div>
          <div style={{ ...headerCellStyle, textAlign: "right", paddingRight: 12 }}>
            Score
          </div>
        </div>
        {/* Rows */}
        {statuses.map((s, i) => (
          <div
            key={s.id}
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "32px 1fr 100px",
              borderBottom:
                i < statuses.length - 1 ? "1px solid var(--rule)" : "none",
            }}
          >
            <div
              style={{
                ...cellStyle,
                color: "var(--ink-tertiary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
            </div>
            <div style={cellStyle}>
              <input
                type="text"
                value={s.name}
                onChange={(e) => {
                  const next = [...statuses];
                  next[i] = { ...s, name: e.target.value };
                  onChange(next);
                }}
                style={inputStyle}
              />
            </div>
            <div style={{ ...cellStyle, justifyContent: "flex-end" }}>
              <input
                type="number"
                min={0}
                max={100}
                value={s.score}
                onChange={(e) => {
                  const val = Math.max(
                    0,
                    Math.min(100, parseInt(e.target.value) || 0)
                  );
                  const next = [...statuses];
                  next[i] = { ...s, score: val };
                  onChange(next);
                }}
                style={{ ...inputStyle, width: 60, textAlign: "right" }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-tertiary)",
                  marginLeft: 2,
                }}
              >
                %
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Health Criteria Tab ────────────────────────────────────────────────────

function HealthCriteriaTab({
  rules,
  onChange,
}: {
  rules: HealthRule[];
  onChange: (r: HealthRule[]) => void;
}) {
  const validation = validateHealthRules(rules);

  const updateRule = (index: number, patch: Partial<HealthRule>) => {
    const next = [...rules];
    next[index] = { ...rules[index], ...patch };
    onChange(next);
  };

  const moveRule = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addCondition = (
    index: number,
    column: "quarter" | "percent"
  ) => {
    const rule = rules[index];
    if (column === "quarter") {
      if (rule.quarterConditions.length >= 2) return;
      const available = Object.keys(QUARTER_CONDITIONS).filter(
        (k) => !rule.quarterConditions.includes(k)
      );
      if (available.length === 0) return;
      const next = [...rules];
      next[index] = {
        ...rule,
        quarterConditions: [...rule.quarterConditions, available[0]],
        quarterOperator:
          rule.quarterConditions.length >= 1 ? rule.quarterOperator : "OR",
      };
      onChange(next);
    } else {
      if (rule.percentConditions.length >= 2) return;
      const available = Object.keys(PERCENT_CONDITIONS).filter(
        (k) => !rule.percentConditions.includes(k)
      );
      if (available.length === 0) return;
      const next = [...rules];
      next[index] = {
        ...rule,
        percentConditions: [...rule.percentConditions, available[0]],
        percentOperator:
          rule.percentConditions.length >= 1 ? rule.percentOperator : "OR",
      };
      onChange(next);
    }
  };

  const removeCondition = (
    index: number,
    column: "quarter" | "percent",
    condIndex: number
  ) => {
    const rule = rules[index];
    if (column === "quarter") {
      if (rule.quarterConditions.length <= 1) return;
      const next = [...rules];
      next[index] = {
        ...rule,
        quarterConditions: rule.quarterConditions.filter(
          (_, i) => i !== condIndex
        ),
      };
      onChange(next);
    } else {
      if (rule.percentConditions.length <= 1) return;
      const next = [...rules];
      next[index] = {
        ...rule,
        percentConditions: rule.percentConditions.filter(
          (_, i) => i !== condIndex
        ),
      };
      onChange(next);
    }
  };

  const setConditionValue = (
    index: number,
    column: "quarter" | "percent",
    condIndex: number,
    value: string
  ) => {
    const rule = rules[index];
    if (column === "quarter") {
      const next = [...rules];
      const conds = [...rule.quarterConditions];
      conds[condIndex] = value;
      next[index] = { ...rule, quarterConditions: conds };
      onChange(next);
    } else {
      const next = [...rules];
      const conds = [...rule.percentConditions];
      conds[condIndex] = value;
      next[index] = { ...rule, percentConditions: conds };
      onChange(next);
    }
  };

  return (
    <div>
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-secondary)",
          marginBottom: 8,
        }}
      >
        Rules are evaluated top-to-bottom. First matching rule determines
        project health. Use arrows to reorder.
      </p>

      {!validation.valid && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 12,
            background: "#FFF0EE",
            border: "1px solid #FECACA",
            borderRadius: 3,
            fontSize: 12,
            color: "#B91C1C",
          }}
        >
          <strong>Warning:</strong> Rules don&apos;t cover all project states.
          Uncovered: {validation.gaps.join(", ")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rules.map((rule, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--rule)",
              borderRadius: 3,
              background: "var(--surface)",
            }}
          >
            {/* Rule header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderBottom: "1px solid var(--rule)",
                background: "var(--ground-metric)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-secondary)",
                  }}
                >
                  Rule {i + 1}
                </span>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  onClick={() => moveRule(i, -1)}
                  disabled={i === 0}
                  style={arrowBtnStyle(i === 0)}
                  title="Move up"
                >
                  &#9650;
                </button>
                <button
                  onClick={() => moveRule(i, 1)}
                  disabled={i === rules.length - 1}
                  style={arrowBtnStyle(i === rules.length - 1)}
                  title="Move down"
                >
                  &#9660;
                </button>
              </div>
            </div>

            {/* Rule body */}
            <div style={{ padding: "8px 10px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 40px 1fr 140px",
                  gap: 8,
                  alignItems: "start",
                }}
              >
                {/* Quarter conditions column */}
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-tertiary)",
                      marginBottom: 4,
                    }}
                  >
                    Quarter
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {rule.quarterConditions.map((cond, ci) => (
                      <div key={ci} style={{ display: "flex", gap: 4 }}>
                        <select
                          value={cond}
                          onChange={(e) =>
                            setConditionValue(i, "quarter", ci, e.target.value)
                          }
                          style={selectStyle}
                        >
                          {Object.entries(QUARTER_CONDITIONS).map(
                            ([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                        {rule.quarterConditions.length > 1 && (
                          <button
                            onClick={() => removeCondition(i, "quarter", ci)}
                            style={removeBtnStyle}
                            title="Remove"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                    {rule.quarterConditions.length < 2 &&
                      !rule.quarterConditions.includes("regardless") && (
                        <button
                          onClick={() => addCondition(i, "quarter")}
                          style={addBtnStyle}
                        >
                          + add
                        </button>
                      )}
                  </div>
                </div>

                {/* Operator between columns */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 18,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--ink-tertiary)",
                    }}
                  >
                    AND
                  </span>
                </div>

                {/* Percent conditions column */}
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-tertiary)",
                      marginBottom: 4,
                    }}
                  >
                    Percent
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {rule.percentConditions.map((cond, ci) => (
                      <div key={ci} style={{ display: "flex", gap: 4 }}>
                        <select
                          value={cond}
                          onChange={(e) =>
                            setConditionValue(i, "percent", ci, e.target.value)
                          }
                          style={selectStyle}
                        >
                          {Object.entries(PERCENT_CONDITIONS).map(
                            ([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                        {rule.percentConditions.length > 1 && (
                          <button
                            onClick={() => removeCondition(i, "percent", ci)}
                            style={removeBtnStyle}
                            title="Remove"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                    {rule.percentConditions.length < 2 &&
                      !rule.percentConditions.includes("any") && (
                        <button
                          onClick={() => addCondition(i, "percent")}
                          style={addBtnStyle}
                        >
                          + add
                        </button>
                      )}
                  </div>
                </div>

                {/* Health Status */}
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-tertiary)",
                      marginBottom: 4,
                    }}
                  >
                    Health Status
                  </div>
                  <input
                    type="text"
                    value={rule.healthStatus}
                    onChange={(e) =>
                      updateRule(i, { healthStatus: e.target.value })
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Meaning */}
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--ink-secondary)",
                  fontStyle: "italic",
                }}
              >
                {generateMeaning(rule)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Formulas Tab ───────────────────────────────────────────────────────────

function FormulasTab({
  statuses,
}: {
  statuses: ComputationStatus[];
}) {
  const scoreMap = statuses.map((s) => `${s.name} → ${s.score}%`).join(", ");
  return (
    <div>
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-secondary)",
          marginBottom: 16,
        }}
      >
        How completion rates and health are calculated at each level.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
        }}
      >
        <FormulaRow label="Task" formula={`status → score (${statuses.map((s) => s.score).join("/")})`} />
        <FormulaRow
          label="Project"
          formula="mean of its tasks' scores"
        />
        <FormulaRow
          label="Program"
          formula="mean of ALL its projects"
        />
        <FormulaRow
          label="Framework"
          formula="mean of ALL its programs"
        />
      </div>
      <div
        style={{
          marginTop: 20,
          padding: "12px 16px",
          background: "var(--ground-metric)",
          borderRadius: 3,
          fontSize: 12,
          color: "var(--ink-secondary)",
        }}
      >
        <strong style={{ color: "var(--ink-primary)" }}>Score mapping:</strong>{" "}
        {scoreMap}
      </div>
    </div>
  );
}

function FormulaRow({
  label,
  formula,
}: {
  label: string;
  formula: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "baseline",
        padding: "8px 0",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-tertiary)",
          minWidth: 80,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--ink-primary)" }}>{formula}</span>
    </div>
  );
}

// ── Abandonment Reasons Tab ────────────────────────────────────────────────

function AbandonmentReasonsTab({
  reasons,
  onChange,
}: {
  reasons: string[];
  onChange: (r: string[]) => void;
}) {
  const [newReason, setNewReason] = useState("");

  function addReason() {
    const trimmed = newReason.trim();
    if (!trimmed || reasons.includes(trimmed)) return;
    onChange([...reasons, trimmed]);
    setNewReason("");
  }

  function removeReason(index: number) {
    onChange(reasons.filter((_, i) => i !== index));
  }

  function updateReason(index: number, value: string) {
    const next = [...reasons];
    next[index] = value;
    onChange(next);
  }

  return (
    <div>
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-secondary)",
          marginBottom: 16,
        }}
      >
        Manage the list of reasons shown in the Abandon confirmation dialog.
        Users must select one of these when abandoning a program, project, or
        task.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {reasons.map((reason, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-tertiary)",
                minWidth: 24,
                textAlign: "right",
              }}
            >
              {i + 1}.
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => updateReason(i, e.target.value)}
              style={{
                flex: 1,
                border: "1px solid var(--rule)",
                borderRadius: 3,
                padding: "6px 10px",
                fontSize: 12,
                outline: "none",
              }}
            />
            <button
              onClick={() => removeReason(i)}
              style={{
                fontSize: 11,
                color: "var(--ink-tertiary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
              }}
              title="Remove reason"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          type="text"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addReason();
          }}
          placeholder="New reason…"
          style={{
            flex: 1,
            border: "1px solid var(--rule)",
            borderRadius: 3,
            padding: "6px 10px",
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          onClick={addReason}
          disabled={!newReason.trim()}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "#FFFFFF",
            background: "var(--accent)",
            border: "none",
            borderRadius: 3,
            cursor: newReason.trim() ? "pointer" : "default",
            opacity: newReason.trim() ? 1 : 0.5,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────

export default function ComputationSettingsModal({ open, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("statuses");
  const [settings, setSettings] = useState<ComputationSettings>(
    getDefaultSettings()
  );
  const [original, setOriginal] = useState<ComputationSettings>(
    getDefaultSettings()
  );
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/computation");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setOriginal(data);
      }
    } catch {
      // use defaults
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSettings();
      setError(null);
      setSuccess(null);
    }
  }, [open, fetchSettings]);

  const isDirty =
    JSON.stringify(settings) !== JSON.stringify(original);

  const hasRenamedStatuses = settings.statuses.some((s, i) => {
    const orig = original.statuses[i];
    return orig && s.name !== orig.name;
  });

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate health rules
    const validation = validateHealthRules(settings.healthRules);
    if (!validation.valid) {
      setError(
        "Rules don't cover all project states. Uncovered: " +
          validation.gaps.join(", ")
      );
      setLoading(false);
      return;
    }

    // Confirm if renaming statuses
    if (hasRenamedStatuses) {
      const renames = settings.statuses
        .map((s, i) => {
          const orig = original.statuses[i];
          return orig && s.name !== orig.name
            ? `"${orig.name}" → "${s.name}"`
            : null;
        })
        .filter(Boolean);
      if (
        !window.confirm(
          `This will rename status labels across existing tasks:\n${renames.join(
            "\n"
          )}\n\nContinue?`
        )
      ) {
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/settings/computation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save settings.");
        setLoading(false);
        return;
      }

      // Show migration summary
      const migrated = data.migrated as Record<string, number>;
      const totalMigrated = Object.values(migrated).reduce(
        (a, b) => a + b,
        0
      );
      if (totalMigrated > 0) {
        const summary = Object.entries(migrated)
          .map(([k, v]) => `${k}: ${v} tasks`)
          .join(", ");
        setSuccess(`Settings saved. Migrated ${summary}.`);
      } else {
        setSuccess("Settings saved successfully.");
      }

      setOriginal(settings);
      router.refresh();
    } catch {
      setError("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(getDefaultSettings());
  };

  const handleClose = () => {
    if (isDirty) {
      if (
        window.confirm(
          "You have unsaved changes. Discard?"
        )
      ) {
        setSettings(original);
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (fetching) {
    return (
      <Modal open={open} onClose={handleClose} title="Settings" wide>
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--ink-tertiary)",
            fontSize: 13,
          }}
        >
          Loading settings...
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Settings" wide>
      <div>
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--rule)",
            marginBottom: 20,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: tab === t.key ? 600 : 400,
                color:
                  tab === t.key
                    ? "var(--accent)"
                    : "var(--ink-secondary)",
                background: "none",
                border: "none",
                borderBottom:
                  tab === t.key
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ minHeight: 300 }}>
          {tab === "statuses" && (
            <StatusesTab
              statuses={settings.statuses}
              onChange={(statuses) =>
                setSettings({ ...settings, statuses })
              }
            />
          )}
          {tab === "health" && (
            <HealthCriteriaTab
              rules={settings.healthRules}
              onChange={(healthRules) =>
                setSettings({ ...settings, healthRules })
              }
            />
          )}
          {tab === "formulas" && (
            <FormulasTab statuses={settings.statuses} />
          )}
          {tab === "abandonment" && (
            <AbandonmentReasonsTab
              reasons={settings.abandonmentReasons ?? []}
              onChange={(abandonmentReasons) =>
                setSettings({ ...settings, abandonmentReasons })
              }
            />
          )}
        </div>

        {/* Error / Success */}
        {error && (
          <p
            style={{
              color: "#B91C1C",
              fontSize: 12,
              marginTop: 12,
              padding: "8px 12px",
              background: "#FFF0EE",
              borderRadius: 3,
            }}
          >
            {error}
          </p>
        )}
        {success && (
          <p
            style={{
              color: "#1A6B3C",
              fontSize: 12,
              marginTop: 12,
              padding: "8px 12px",
              background: "#E6F4EE",
              borderRadius: 3,
            }}
          >
            {success}
          </p>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--rule)",
          }}
        >
          <button
            onClick={handleReset}
            style={{
              fontSize: 12,
              color: "var(--ink-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleApply}
            disabled={loading || !isDirty}
            style={{
              padding: "8px 20px",
              fontSize: 12,
              fontWeight: 600,
              color: "#FFFFFF",
              background: isDirty ? "var(--accent)" : "var(--rule)",
              borderRadius: 3,
              opacity: loading || !isDirty ? 0.5 : 1,
              cursor: loading || !isDirty ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────

const headerCellStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-secondary)",
};

const cellStyle: React.CSSProperties = {
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--rule-strong)",
  borderRadius: 3,
  padding: "5px 8px",
  fontSize: 12,
  outline: "none",
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid var(--rule-strong)",
  borderRadius: 3,
  padding: "4px 6px",
  fontSize: 12,
  outline: "none",
  background: "var(--surface)",
  fontFamily: "inherit",
};

const addBtnStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--accent)",
  background: "none",
  border: "1px dashed var(--rule-strong)",
  borderRadius: 3,
  padding: "3px 8px",
  cursor: "pointer",
  textAlign: "left",
};

const removeBtnStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--ink-tertiary)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 4px",
  lineHeight: 1,
};

function arrowBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 10,
    color: disabled ? "var(--rule)" : "var(--ink-secondary)",
    background: "none",
    border: "1px solid var(--rule)",
    borderRadius: 2,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "2px 6px",
    lineHeight: 1,
  };
}
