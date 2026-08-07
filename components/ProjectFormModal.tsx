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
  onSave: () => void;
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
      onSave();
      onClose();
    } else {
      const data = await res.json();
      setServerError(data.error || "Failed to save project");
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
      title={isEdit ? "Edit Project" : "Add Project"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        {!frameworkId && !isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Framework *
            </label>
            <select
              value={selectedFrameworkId}
              onChange={(e) => setSelectedFrameworkId(parseInt(e.target.value))}
              className={inputClass(frameworkInvalid)}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Program *
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(parseInt(e.target.value))}
              className={inputClass(programInvalid)}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <QuarterSelect
          label="Target Quarter *"
          value={targetQuarter}
          onChange={setTargetQuarter}
          invalid={quarterInvalid}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actual Completion Date
          </label>
          <input
            type="date"
            value={actualCompletionDate}
            onChange={(e) => setActualCompletionDate(e.target.value)}
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
