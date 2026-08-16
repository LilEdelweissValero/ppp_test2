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

export default function ImportExcelModal({ open, onClose, onSave }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
      setError("Please select an Excel file");
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

  async function handleDownloadTemplate() {
    try {
      const res = await fetch("/api/import");
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ppp_tracker_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download template");
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ppp_tracker_export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export tasks");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import / Export Excel">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── Import section ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handleDownloadTemplate}
            style={{
              fontSize: 12,
              color: "var(--accent)",
              textDecoration: "underline",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              width: "fit-content",
            }}
          >
            Download Excel Template
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{
                flex: 1,
                fontSize: 12,
                color: "var(--ink-tertiary)",
              }}
            />
            <button
              onClick={handleUpload}
              disabled={loading}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                background: "var(--accent)",
                border: "none",
                borderRadius: 3,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              {loading ? "Importing..." : "Import"}
            </button>
          </div>
        </div>

        {/* ── Divider ── */}
        <hr style={{ border: "none", borderTop: "1px solid var(--rule)", margin: 0 }} />

        {/* ── Export section ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: 0 }}>
            Export all existing tasks (including archived) to an Excel file.
          </p>
          <div>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                background: "var(--accent)",
                border: "none",
                borderRadius: 3,
                cursor: exporting ? "not-allowed" : "pointer",
                opacity: exporting ? 0.5 : 1,
              }}
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#B91C1C", margin: 0 }}>{error}</p>
        )}

        {result && (
          <div
            style={{
              background: "#E6F4EE",
              border: "1px solid #1A6B3C",
              borderRadius: 3,
              padding: 16,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <p style={{ fontWeight: 500, color: "#1A6B3C", margin: 0 }}>
              Import Complete
            </p>
            <p style={{ margin: 0 }}>Frameworks created: {result.frameworksCreated}</p>
            <p style={{ margin: 0 }}>Programs created: {result.programsCreated}</p>
            <p style={{ margin: 0 }}>Projects created: {result.projectsCreated}</p>
            <p style={{ margin: 0 }}>Tasks created: {result.tasksCreated}</p>
            <p style={{ margin: 0 }}>Tasks skipped (duplicates): {result.tasksSkipped}</p>
            <p style={{ margin: 0 }}>Rows skipped (errors): {result.rowsSkipped}</p>
            {result.errors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontWeight: 500, color: "#B91C1C", margin: 0 }}>
                  Errors:
                </p>
                <ul
                  style={{
                    listStyleType: "disc",
                    paddingLeft: 20,
                    color: "#B91C1C",
                    fontSize: 11,
                    maxHeight: 160,
                    overflowY: "auto",
                    margin: 0,
                  }}
                >
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              color: "var(--ink-primary)",
              background: "var(--ground)",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            {result ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
