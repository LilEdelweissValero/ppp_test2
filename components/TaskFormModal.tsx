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

  function inputClass(invalid: boolean) {
    const base = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ";
    if (invalid) return base + "border-red-500 focus:ring-red-500";
    return base + "border-gray-300 focus:ring-blue-500";
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Task" : "Add Task"}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Code *
            </label>
            <input
              type="text"
              value={taskCode}
              onChange={(e) => setTaskCode(e.target.value)}
              disabled={isEdit}
              className={inputClass(taskCodeInvalid) + (isEdit ? " disabled:bg-gray-50" : "")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass(nameInvalid)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assignee
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITY_LABELS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dependencies
            </label>
            <input
              type="text"
              value={dependencies}
              onChange={(e) => setDependencies(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deliverable
            </label>
            <input
              type="text"
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Attachment URL
          </label>
          <input
            type="url"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass(attachmentInvalid)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {serverError && <p className="text-red-600 text-sm">{serverError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
