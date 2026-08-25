"use client";

import { useState, useRef, useEffect } from "react";
import Modal from "./Modal";

interface ImportPreview {
  frameworks: number;
  programs: number;
  projects: number;
  tasks: number;
  specialTasks: number;
  problems: { row: string; sheet: string; reason: string }[];
  totalRows: number;
}

interface ImportResult {
  frameworksCreated: number;
  programsCreated: number;
  projectsCreated: number;
  tasksCreated: number;
  specialTasksCreated: number;
  tasksSkipped: number;
  specialTasksSkipped: number;
  rowsSkipped: number;
  errors: string[];
}

type Phase = "idle" | "validating" | "preview" | "importing" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function ImportExcelModal({ open, onClose, onSave }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setPreview(null);
      setResult(null);
      setError("");
      setProgress({ processed: 0, total: 0 });
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  async function readNdjsonStream(
    res: Response,
    onEvent: (event: Record<string, unknown>) => void
  ) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line.trim()) {
          onEvent(JSON.parse(line));
        }
      }
    }
    if (buffer.trim()) {
      onEvent(JSON.parse(buffer));
    }
  }

  async function handleValidate() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select an Excel file");
      return;
    }

    setPhase("validating");
    setError("");
    setPreview(null);
    setResult(null);
    setProgress({ processed: 0, total: 0 });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("dryRun", "true");

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Validation failed");
        setPhase("idle");
        return;
      }

      await readNdjsonStream(res, (event) => {
        if (event.type === "progress") {
          setProgress({ processed: event.processed as number, total: event.total as number });
        } else if (event.type === "preview") {
          setPreview({
            frameworks: event.frameworks as number,
            programs: event.programs as number,
            projects: event.projects as number,
            tasks: event.tasks as number,
            specialTasks: event.specialTasks as number,
            problems: (event.problems as ImportPreview["problems"]) || [],
            totalRows: event.totalRows as number,
          });
          setPhase("preview");
        } else if (event.type === "error") {
          setError(event.error as string);
          setPhase("idle");
        }
      });
    } catch {
      setError("Validation failed");
      setPhase("idle");
    }
  }

  async function handleConfirm() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("No file selected");
      return;
    }

    setPhase("importing");
    setError("");
    setProgress({ processed: 0, total: 0 });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed");
        setPhase("preview");
        return;
      }

      await readNdjsonStream(res, (event) => {
        if (event.type === "progress") {
          setProgress({ processed: event.processed as number, total: event.total as number });
        } else if (event.type === "result") {
          setResult(event as unknown as ImportResult);
          setPhase("done");
          onSave();
        } else if (event.type === "error") {
          setError(event.error as string);
          setPhase("preview");
        }
      });
    } catch {
      setError("Import failed");
      setPhase("preview");
    }
  }

  function handleBackToIdle() {
    setPhase("idle");
    setPreview(null);
    setResult(null);
    setError("");
    setProgress({ processed: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
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

  const progressPct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  const totalImport = preview
    ? preview.frameworks + preview.programs + preview.projects + preview.tasks + preview.specialTasks
    : 0;

  return (
    <Modal open={open} onClose={phase === "validating" || phase === "importing" ? () => {} : onClose} title="Import / Export Excel">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── Progress bar ── */}
        {(phase === "validating" || phase === "importing") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--ink-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {phase === "validating"
                ? `Reading file\u2009\u2026\u2009${progress.processed} / ${progress.total} rows`
                : `Importing\u2009\u2026\u2009${progressPct}% done (${progress.processed} / ${progress.total} rows)`}
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--rule)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "var(--accent)",
                  borderRadius: 3,
                  transition: "width 0.15s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Idle: file input + validate button ── */}
        {phase === "idle" && (
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
                style={{ flex: 1, fontSize: 12, color: "var(--ink-tertiary)" }}
              />
              <button
                onClick={handleValidate}
                style={{
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Import
              </button>
            </div>
          </div>
        )}

        {/* ── Preview: confirmation panel ── */}
        {phase === "preview" && preview && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>
                Preview of <strong>{preview.totalRows}</strong> rows parsed
              </span>
            </div>

            {/* Summary box */}
            <div
              style={{
                background: "var(--ground)",
                border: "1px solid var(--rule)",
                borderRadius: 3,
                padding: 14,
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <p style={{ fontWeight: 600, margin: 0, color: "var(--ink-primary)" }}>
                Ready to import
              </p>
              <p style={{ margin: 0, color: "var(--ink-secondary)" }}>
                {preview.frameworks > 0 && `${preview.frameworks} framework${preview.frameworks !== 1 ? "s" : ""}`}
                {preview.frameworks > 0 && preview.programs > 0 && ", "}
                {preview.programs > 0 && `${preview.programs} program${preview.programs !== 1 ? "s" : ""}`}
                {(preview.frameworks > 0 || preview.programs > 0) && preview.projects > 0 && ", "}
                {preview.projects > 0 && `${preview.projects} project${preview.projects !== 1 ? "s" : ""}`}
                {totalImport > 0 && " \u2014 "}
                {totalImport > 0 && (
                  <>
                    {preview.tasks} task{preview.tasks !== 1 ? "s" : ""}
                    {", "}
                    {preview.specialTasks} special task{preview.specialTasks !== 1 ? "s" : ""}
                  </>
                )}
              </p>
              {totalImport === 0 && preview.problems.length === 0 && (
                <p style={{ margin: 0, color: "var(--ink-tertiary)", fontStyle: "italic" }}>
                  Nothing new to import (all rows match existing data)
                </p>
              )}
            </div>

            {/* Problems list */}
            {preview.problems.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#B91C1C", margin: 0 }}>
                  Rows that will not be imported ({preview.problems.length})
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
                    lineHeight: 1.5,
                  }}
                >
                  {preview.problems.map((p, i) => (
                    <li key={i}>
                      <strong>{p.row}</strong> ({p.sheet}): {p.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer: Cancel + Confirm */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 4,
                borderTop: "1px solid var(--rule)",
              }}
            >
              <button
                type="button"
                onClick={handleBackToIdle}
                style={{
                  padding: "7px 14px",
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
                type="button"
                onClick={handleConfirm}
                disabled={totalImport === 0}
                style={{
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 3,
                  cursor: totalImport === 0 ? "not-allowed" : "pointer",
                  opacity: totalImport === 0 ? 0.5 : 1,
                }}
              >
                Confirm Import
              </button>
            </div>
          </div>
        )}

        {/* ── Import complete result ── */}
        {phase === "done" && result && (
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
            <p style={{ margin: 0 }}>Special tasks created: {result.specialTasksCreated}</p>
            {result.tasksSkipped > 0 && <p style={{ margin: 0, color: "#92400E" }}>Tasks skipped (duplicates): {result.tasksSkipped}</p>}
            {result.specialTasksSkipped > 0 && <p style={{ margin: 0, color: "#92400E" }}>Special tasks skipped (duplicates): {result.specialTasksSkipped}</p>}
            {result.rowsSkipped > 0 && <p style={{ margin: 0, color: "#92400E" }}>Rows skipped (errors): {result.rowsSkipped}</p>}
            {result.errors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontWeight: 500, color: "#B91C1C", margin: 0 }}>Errors:</p>
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

        {/* ── Divider ── */}
        {(phase === "idle" || phase === "done") && (
          <>
            <hr style={{ border: "none", borderTop: "1px solid var(--rule)", margin: 0 }} />
            <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: 0 }}>
              Export all existing tasks (including archived) to an Excel file.
            </p>
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
                flexShrink: 0,
                width: "fit-content",
              }}
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </>
        )}

        {error && (
          <p style={{ fontSize: 12, color: "#B91C1C", margin: 0 }}>{error}</p>
        )}

        {/* ── Footer buttons ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
          {(phase === "idle" || phase === "done") && (
            <button
              type="button"
              onClick={phase === "done" ? handleBackToIdle : onClose}
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
              {phase === "done" ? "Import Another" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
