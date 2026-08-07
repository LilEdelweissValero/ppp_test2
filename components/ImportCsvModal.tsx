"use client";

import { useState, useRef, useEffect } from "react";
import Modal from "./Modal";

interface ImportResult {
  frameworksCreated: number;
  programsCreated: number;
  projectsCreated: number;
  tasksCreated: number;
  tasksSkipped: number;
  rowsSkipped: number;
  errors: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function ImportCsvModal({ open, onClose, onSave }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      setError("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select a CSV file");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      setLoading(false);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        onSave();
      } else {
        const data = await res.json();
        setError(data.error || "Import failed");
      }
    } catch {
      setLoading(false);
      setError("Import failed");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import CSV">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Upload a CSV file with the following columns in order:
        </p>
        <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs overflow-x-auto">
          framework_name, program_name, project_name, project_reference,
          project_owner, project_target_quarter, task_code, task_name,
          task_assignee, task_priority, task_description, task_dependencies,
          task_notes, task_status, task_target_quarter, task_deliverable,
          task_attachment_url
        </pre>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 text-sm space-y-1">
            <p className="font-medium text-green-800">Import Complete</p>
            <p>Frameworks created: {result.frameworksCreated}</p>
            <p>Programs created: {result.programsCreated}</p>
            <p>Projects created: {result.projectsCreated}</p>
            <p>Tasks created: {result.tasksCreated}</p>
            <p>Tasks skipped (duplicates): {result.tasksSkipped}</p>
            <p>Rows skipped (errors): {result.rowsSkipped}</p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-red-700">Errors:</p>
                <ul className="list-disc list-inside text-red-600 text-xs max-h-40 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
