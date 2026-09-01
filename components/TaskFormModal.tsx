"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import QuarterSelect from "./QuarterSelect";
import AbandonConfirmModal from "./AbandonConfirmModal";
import { PRIORITY_LABELS, getStatusList } from "@/lib/status";
import { getDefaultSettings } from "@/lib/computation-settings";
import type { ComputationSettings } from "@/lib/computation-settings";

interface Attachment {
  title: string;
  url: string;
}

interface Phase {
  id: number;
  name: string;
  weight: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (task: { id: number; taskCode: string; name: string; assignee: string | null; priority: string; status: string; description: string | null; dependencies: string | null; notes: string | null; targetQuarter: string; adjustedTargetQuarter: string; deliverable: string | null; attachments: { url: string; title: string | null }[] | null; projectId: number; sortOrder: number; phaseId: number | null }) => void;
  onSaveSpecial?: (specialTask: { id: number; specialTaskCode: string; name: string; total: number; nys: number; plan: number; part: number; mostly: number; done: number; dueQuarter: string; lastUpdatedDate: string | null; projectId: number; sortOrder: number; phaseId: number | null }) => void;
  projectId: number;
  phases?: Phase[];
  initialData?: {
    id: number;
    taskCode: string;
    name: string;
    assignee: string;
    priority: string;
    description: string;
    dependencies: string;
    notes: string;
    status: string;
    targetQuarter: string;
    deliverable: string;
    attachments: { url: string; title: string | null }[];
    phaseId: number | null;
  };
  initialSpecialData?: {
    id: number;
    specialTaskCode: string;
    name: string;
    dueQuarter: string;
    lastUpdatedDate: string | null;
    phaseId: number | null;
  };
  abandonReasons?: string[];
  onAbandon?: () => void;
}

export default function TaskFormModal({
  open,
  onClose,
  onSave,
  onSaveSpecial,
  projectId,
  phases,
  initialData,
  initialSpecialData,
  abandonReasons = [],
  onAbandon,
}: Props) {
  const isEdit = !!initialData;
  const isSpecialEdit = !!initialSpecialData;
  const isSpecialMode = isSpecialEdit || false;

  const [compSettings, setCompSettings] = useState<ComputationSettings | undefined>(undefined);

  useEffect(() => {
    fetch("/api/settings/computation")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCompSettings(data);
      })
      .catch(() => {});
  }, []);

  const [taskType, setTaskType] = useState<"normal" | "special">(isSpecialEdit ? "special" : "normal");
  const [taskCode, setTaskCode] = useState(initialData?.taskCode || initialSpecialData?.specialTaskCode || "");
  const [name, setName] = useState(initialData?.name || initialSpecialData?.name || "");
  const [assignee, setAssignee] = useState(initialData?.assignee || "");
  const [priority, setPriority] = useState(initialData?.priority || "Low");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [dependencies, setDependencies] = useState(
    initialData?.dependencies || ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [status, setStatus] = useState(
    initialData?.status || getDefaultSettings().statuses[0].name
  );
  const [targetQuarter, setTargetQuarter] = useState(
    initialData?.targetQuarter || initialSpecialData?.dueQuarter || ""
  );
  const [deliverable, setDeliverable] = useState(
    initialData?.deliverable || ""
  );
  const [attachments, setAttachments] = useState<Attachment[]>(
    initialData?.attachments?.map(a => ({ title: a.title || "", url: a.url })) || [{ title: "", url: "" }]
  );
  const [phaseId, setPhaseId] = useState<number | null>(initialData?.phaseId ?? initialSpecialData?.phaseId ?? null);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [abandonTarget, setAbandonTarget] = useState<{ id: number; name: string; type: "task" | "special-task" } | null>(null);
  const [abandonLoading, setAbandonLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (isSpecialEdit && initialSpecialData) {
        setTaskType("special");
        setTaskCode(initialSpecialData.specialTaskCode);
        setName(initialSpecialData.name);
        setTargetQuarter(initialSpecialData.dueQuarter);
        setAssignee("");
        setPriority("Low");
        setDescription("");
        setDependencies("");
        setNotes("");
        setStatus(getDefaultSettings().statuses[0].name);
        setDeliverable("");
        setAttachments([{ title: "", url: "" }]);
        setPhaseId(initialSpecialData.phaseId ?? null);
      } else if (!isEdit) {
        setTaskType("normal");
        setTaskCode("");
        setName("");
        setAssignee("");
        setPriority("Low");
        setDescription("");
        setDependencies("");
        setNotes("");
        setStatus(getDefaultSettings().statuses[0].name);
        setTargetQuarter("");
        setDeliverable("");
        setAttachments([{ title: "", url: "" }]);
        setPhaseId(null);
      } else if (initialData) {
        setTaskType("normal");
        setAttachments(
          initialData.attachments?.map(a => ({ title: a.title || "", url: a.url })) || [{ title: "", url: "" }]
        );
        setPhaseId(initialData.phaseId ?? null);
      }
      setServerError("");
      setSubmitted(false);
      setShowDetails(false);
      setShowAdditional(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const taskCodeInvalid = submitted && !taskCode.trim();
  const nameInvalid = submitted && !name.trim();
  const quarterInvalid = submitted && !targetQuarter;

  function isUrlValid(url: string): boolean {
    return url === "" || /^https?:\/\//.test(url);
  }

  function updateAttachment(index: number, field: "title" | "url", value: string) {
    setAttachments(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  }

  function addAttachment() {
    setAttachments(prev => [...prev, { title: "", url: "" }]);
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  const validAttachments = attachments.filter(a => a.url.trim() !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError("");

    if (!taskCode.trim() || !name.trim() || !targetQuarter) {
      return;
    }

    if (taskType === "special") {
      setLoading(true);
      try {
        const url = isSpecialEdit ? `/api/special-tasks/${initialSpecialData?.id}` : "/api/special-tasks";
        const method = isSpecialEdit ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            specialTaskCode: taskCode,
            name,
            dueQuarter: targetQuarter,
            phaseId: phaseId ? String(phaseId) : null,
          }),
        });

        if (res.ok) {
          const specialTask = await res.json();
          if (onSaveSpecial) onSaveSpecial(specialTask);
          onClose();
        } else {
          const data = await res.json();
          setServerError(data.error || "Failed to save special task");
        }
      } catch {
        setServerError("Failed to save special task");
      } finally {
        setLoading(false);
      }
      return;
    }

    for (const att of attachments) {
      if (att.url && !isUrlValid(att.url)) {
        setServerError("All attachment URLs must start with http:// or https://");
        return;
      }
    }

    setLoading(true);

    const attachmentsToSave = validAttachments.map(a => ({
      url: a.url,
      title: a.title || null,
    }));

    try {
      const url = isEdit ? `/api/tasks/${initialData?.id}` : "/api/tasks";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          taskCode,
          name,
          assignee,
          priority,
          description,
          dependencies,
          notes,
          status,
          targetQuarter,
          deliverable,
          attachments: attachmentsToSave.length > 0 ? attachmentsToSave : null,
          phaseId: phaseId ? String(phaseId) : null,
        }),
      });

      if (res.ok) {
        const task = await res.json();
        onSave(task);
        onClose();
      } else {
        const data = await res.json();
        setServerError(data.error || "Failed to save task");
      }
    } catch {
      setServerError("Failed to save task");
    } finally {
      setLoading(false);
    }
  }

  const hasOptionalContent = description || dependencies || deliverable || validAttachments.length > 0 || notes;
  const showTypeSelector = !isEdit && !isSpecialEdit;

  const inputStyle = (invalid?: boolean): React.CSSProperties => ({
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

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--ink-tertiary)",
    marginBottom: 8,
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Task" : isSpecialEdit ? "Edit Special Task" : "Add Task"}
      wide
    >
      <form onSubmit={handleSubmit}>
        {/* ── Section: Type (only on add) ── */}
        {showTypeSelector && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={sectionHeaderStyle}>
              Type
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>
                  Task Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as "normal" | "special")}
                  style={inputStyle()}
                >
                  <option value="normal">Normal</option>
                  <option value="special">Special</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Section: Identity ── */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={sectionHeaderStyle}>
            Identity
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>
                {taskType === "special" ? "Special Task Code *" : "Task Code *"}
              </label>
              <input
                type="text"
                value={taskCode}
                onChange={(e) => setTaskCode(e.target.value)}
                style={inputStyle(taskCodeInvalid)}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle(nameInvalid)}
              />
            </div>
          </div>
        </div>

        {/* ── Phase (when phases exist) ── */}
        {phases && phases.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={sectionHeaderStyle}>Phase</h3>
            <div>
              <label style={labelStyle}>Phase</label>
              <select
                value={phaseId ?? ""}
                onChange={(e) => setPhaseId(e.target.value ? parseInt(e.target.value) : null)}
                style={inputStyle()}
              >
                <option value="">— No phase —</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.weight}%)</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Section: Assignment (normal tasks only) ── */}
        {taskType === "normal" && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={sectionHeaderStyle}>
              Assignment
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>
                  Assignee
                </label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={inputStyle()}
                >
                  {PRIORITY_LABELS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>
                  Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={inputStyle()}
                >
                  {getStatusList(compSettings).map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <QuarterSelect
                label="Planned Quarter *"
                value={targetQuarter}
                onChange={setTargetQuarter}
                invalid={quarterInvalid}
              />
            </div>
          </div>
        )}

        {/* ── Section: Due Quarter (special tasks only) ── */}
        {taskType === "special" && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={sectionHeaderStyle}>
              Schedule
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <QuarterSelect
                label="Due Quarter *"
                value={targetQuarter}
                onChange={setTargetQuarter}
                invalid={quarterInvalid}
              />
            </div>
          </div>
        )}

        {/* ── Section: Details (collapsible, normal tasks only) ── */}
        {taskType === "normal" && (
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-tertiary)",
              }}
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="none"
                style={{
                  transform: showDetails ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s",
                }}
              >
                <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Details
              {hasOptionalContent && !showDetails && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 400,
                  letterSpacing: "normal",
                  textTransform: "none",
                  color: "var(--ink-tertiary)",
                }}>
                  (has content)
                </span>
              )}
            </button>

            {showDetails && (
              <div style={{ paddingTop: 8 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    style={{
                      ...inputStyle(),
                      resize: "vertical",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>
                      Dependencies
                    </label>
                    <input
                      type="text"
                      value={dependencies}
                      onChange={(e) => setDependencies(e.target.value)}
                      style={inputStyle()}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Deliverable
                    </label>
                    <input
                      type="text"
                      value={deliverable}
                      onChange={(e) => setDeliverable(e.target.value)}
                      style={inputStyle()}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section: Additional (collapsible, normal tasks only) ── */}
        {taskType === "normal" && (
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowAdditional(!showAdditional)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-tertiary)",
              }}
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="none"
                style={{
                  transform: showAdditional ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s",
                }}
              >
                <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Additional
            </button>

            {showAdditional && (
              <div style={{ paddingTop: 8 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>
                    Attachments
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {attachments.map((att, index) => (
                      <div key={index} className="attachment-row">
                        <input
                          type="text"
                          value={att.title}
                          onChange={(e) => updateAttachment(index, "title", e.target.value)}
                          placeholder="Display Title (optional)"
                          style={{
                            ...inputStyle(),
                            flex: "0 0 200px",
                          }}
                        />
                        <input
                          type="url"
                          value={att.url}
                          onChange={(e) => updateAttachment(index, "url", e.target.value)}
                          placeholder="https://..."
                          style={{
                            ...inputStyle(att.url !== "" && !isUrlValid(att.url)),
                            flex: 1,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="attachment-remove-btn"
                          disabled={attachments.length === 1}
                          title="Remove URL"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addAttachment}
                    className="attachment-add-btn"
                  >
                    + Add URL
                  </button>
                </div>
                <div>
                  <label style={labelStyle}>
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    style={{
                      ...inputStyle(),
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Error ── */}
        {serverError && (
          <p style={{
            fontSize: 12,
            color: "#B91C1C",
            marginBottom: 12,
          }}>
            {serverError}
          </p>
        )}

        {/* ── Actions ── */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 12,
          borderTop: "1px solid var(--rule)",
        }}>
          <div>
            {(isEdit || isSpecialEdit) && (
              <button
                type="button"
                onClick={() => {
                  const taskType = isSpecialEdit ? "special-task" : "task";
                  const taskName = isSpecialEdit
                    ? `${initialSpecialData?.specialTaskCode}: ${initialSpecialData?.name}`
                    : `${initialData?.taskCode}: ${initialData?.name}`;
                  const taskId = isSpecialEdit ? initialSpecialData!.id : initialData!.id;
                  setAbandonTarget({ id: taskId, name: taskName, type: taskType });
                }}
                style={{
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#B91C1C",
                  background: "none",
                  border: "1px solid #B91C1C",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                Abandon
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "7px 12px",
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
        </div>
      </form>
    </Modal>

    {abandonTarget && (
      <AbandonConfirmModal
        open={!!abandonTarget}
        onClose={() => setAbandonTarget(null)}
        onConfirm={async (reason, remarks) => {
          setAbandonLoading(true);
          try {
            const endpoint = abandonTarget.type === "special-task" ? "special-tasks" : "tasks";
            const res = await fetch(`/api/${endpoint}/${abandonTarget.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                abandoned: true,
                abandonedReason: reason,
                abandonedRemarks: remarks || null,
              }),
            });
            if (res.ok) {
              setAbandonTarget(null);
              onAbandon?.();
              onClose();
            }
          } finally {
            setAbandonLoading(false);
          }
        }}
        entityType={abandonTarget.type === "special-task" ? "SpecialTask" : "Task"}
        entityName={abandonTarget.name}
        entityId={abandonTarget.id}
        reasons={abandonReasons}
        loading={abandonLoading}
      />
    )}
    </>
  );
}
