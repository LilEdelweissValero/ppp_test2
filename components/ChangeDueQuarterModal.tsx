"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import QuarterSelect from "./QuarterSelect";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
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

    const url =
      entityType === "Project"
        ? `/api/projects/${entityId}/change-quarter`
        : `/api/tasks/${entityId}/change-quarter`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newQuarter, remarks }),
    });

    setLoading(false);
    if (res.ok) {
      onSave();
      onClose();
    } else {
      const data = await res.json();
      setServerError(data.error || "Failed to change quarter");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change Due Quarter">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Quarter Due
          </label>
          <input
            type="text"
            value={currentQuarter}
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
          />
        </div>

        <QuarterSelect
          label="New Quarter *"
          value={newQuarter}
          onChange={setNewQuarter}
          invalid={quarterInvalid}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
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
