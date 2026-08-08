"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import QuarterSelect from "./QuarterSelect";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/status";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  projectId: number;
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
    attachmentUrl: string;
  };
}

export default function TaskFormModal({
  open,
  onClose,
  onSave,
  projectId,
  initialData,
}: Props) {
  const isEdit = !!initialData;
  const [taskCode, setTaskCode] = useState(initialData?.taskCode || "");
  const [name, setName] = useState(initialData?.name || "");
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
    initialData?.status || "Not Yet Started"
  );
  const [targetQuarter, setTargetQuarter] = useState(
    initialData?.targetQuarter || ""
  );
  const [deliverable, setDeliverable] = useState(
    initialData?.deliverable || ""
  );
  const [attachmentUrl, setAttachmentUrl] = useState(
    initialData?.attachmentUrl || ""
  );
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);

  useEffect(() => {
    if (open) {
      if (!isEdit) {
        setTaskCode("");
        setName("");
        setAssignee("");
        setPriority("Low");
        setDescription("");
        setDependencies("");
        setNotes("");
        setStatus("Not Yet Started");
        setTargetQuarter("");
        setDeliverable("");
        setAttachmentUrl("");
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
  const attachmentInvalid = submitted && attachmentUrl !== "" && !/^https?:\/\//.test(attachmentUrl);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError("");

    if (!taskCode.trim() || !name.trim() || !targetQuarter) {
      return;
    }

    if (attachmentUrl && !/^https?:\/\//.test(attachmentUrl)) {
      setServerError("Attachment URL must start with http:// or https://");
      return;
    }

    setLoading(true);

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
        attachmentUrl: attachmentUrl || null,
      }),
    });

    setLoading(false);
    if (res.ok) {
      onSave();
      onClose();
    } else {
      const data = await res.json();
      setServerError(data.error || "Failed to save task");
    }
  }

  const hasOptionalContent = description || dependencies || deliverable || attachmentUrl || notes;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Task" : "Add Task"}
      wide
    >
      <form onSubmit={handleSubmit}>
        {/* ── Section: Identity ── */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-tertiary)",
            marginBottom: 8,
          }}>
            Identity
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-secondary)",
                marginBottom: 4,
              }}>
                Task Code *
              </label>
              <input
                type="text"
                value={taskCode}
                onChange={(e) => setTaskCode(e.target.value)}
                disabled={isEdit}
                style={{
                  width: "100%",
                  border: `1px solid ${taskCodeInvalid ? "#B91C1C" : "var(--rule-strong)"}`,
                  borderRadius: 3,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--ink-primary)",
                  background: isEdit ? "var(--ground)" : "var(--surface)",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-secondary)",
                marginBottom: 4,
              }}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${nameInvalid ? "#B91C1C" : "var(--rule-strong)"}`,
                  borderRadius: 3,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--ink-primary)",
                  background: "var(--surface)",
                  outline: "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Section: Assignment ── */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-tertiary)",
            marginBottom: 8,
          }}>
            Assignment
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-secondary)",
                marginBottom: 4,
              }}>
                Assignee
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--rule-strong)",
                  borderRadius: 3,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--ink-primary)",
                  background: "var(--surface)",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-secondary)",
                marginBottom: 4,
              }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--rule-strong)",
                  borderRadius: 3,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--ink-primary)",
                  background: "var(--surface)",
                  outline: "none",
                }}
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
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-secondary)",
                marginBottom: 4,
              }}>
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--rule-strong)",
                  borderRadius: 3,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--ink-primary)",
                  background: "var(--surface)",
                  outline: "none",
                }}
              >
                {STATUS_LABELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <QuarterSelect
              label="Target Quarter *"
              value={targetQuarter}
              onChange={setTargetQuarter}
              invalid={quarterInvalid}
            />
          </div>
        </div>

        {/* ── Section: Details (collapsible) ── */}
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
                <label style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--ink-secondary)",
                  marginBottom: 4,
                }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    border: "1px solid var(--rule-strong)",
                    borderRadius: 3,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "var(--ink-primary)",
                    background: "var(--surface)",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ink-secondary)",
                    marginBottom: 4,
                  }}>
                    Dependencies
                  </label>
                  <input
                    type="text"
                    value={dependencies}
                    onChange={(e) => setDependencies(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid var(--rule-strong)",
                      borderRadius: 3,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: "var(--ink-primary)",
                      background: "var(--surface)",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ink-secondary)",
                    marginBottom: 4,
                  }}>
                    Deliverable
                  </label>
                  <input
                    type="text"
                    value={deliverable}
                    onChange={(e) => setDeliverable(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid var(--rule-strong)",
                      borderRadius: 3,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: "var(--ink-primary)",
                      background: "var(--surface)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section: Additional (collapsible) ── */}
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
                <label style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--ink-secondary)",
                  marginBottom: 4,
                }}>
                  Attachment URL
                </label>
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                  style={{
                    width: "100%",
                    border: `1px solid ${attachmentInvalid ? "#B91C1C" : "var(--rule-strong)"}`,
                    borderRadius: 3,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "var(--ink-primary)",
                    background: "var(--surface)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--ink-secondary)",
                  marginBottom: 4,
                }}>
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    border: "1px solid var(--rule-strong)",
                    borderRadius: 3,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "var(--ink-primary)",
                    background: "var(--surface)",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          )}
        </div>

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
      </form>
    </Modal>
  );
}
