"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Modal from "./Modal";

interface ImportPreview {
  frameworks: number;
  programs: number;
  projects: number;
  tasks: number;
  specialTasks: number;
  hasTaskSheet: boolean;
  hasSpecialTasksSheet: boolean;
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
  const [tab, setTab] = useState<"import" | "export">("import");
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportCounts, setExportCounts] = useState<{ tasks: number; specialTasks: number } | null>(null);
  const [exportCountsLoading, setExportCountsLoading] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab("import");
      setPhase("idle");
      setPreview(null);
      setResult(null);
      setError("");
      setProgress({ processed: 0, total: 0 });
      setSelectedFile(null);
      setDragOver(false);
      setExportCounts(null);
      setProblemsOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  const fetchExportCounts = useCallback(async () => {
    if (exportCounts || exportCountsLoading) return;
    setExportCountsLoading(true);
    try {
      const res = await fetch("/api/export/count");
      if (res.ok) {
        setExportCounts(await res.json());
      }
    } catch {
      // counts stay null; UI degrades gracefully
    } finally {
      setExportCountsLoading(false);
    }
  }, [exportCounts, exportCountsLoading]);

  useEffect(() => {
    if (tab === "export" && open) fetchExportCounts();
  }, [tab, open, fetchExportCounts]);

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
    const file = selectedFile;
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
        if (event.type === "progress" && event.phase === "reading") {
          setProgress({ processed: event.processed as number, total: event.total as number });
        } else if (event.type === "preview") {
          setProgress({ processed: 0, total: 0 });
          setPreview({
            frameworks: event.frameworks as number,
            programs: event.programs as number,
            projects: event.projects as number,
            tasks: event.tasks as number,
            specialTasks: event.specialTasks as number,
            hasTaskSheet: event.hasTaskSheet as boolean,
            hasSpecialTasksSheet: event.hasSpecialTasksSheet as boolean,
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
    const file = selectedFile;
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
        if (event.type === "progress" && event.phase === "importing") {
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

  function handleResetImport() {
    setPhase("idle");
    setPreview(null);
    setResult(null);
    setError("");
    setProgress({ processed: 0, total: 0 });
    setSelectedFile(null);
    setProblemsOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileSelect(file: File | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setError("Unsupported file type. Please use .xlsx or .xls files.");
      return;
    }
    setSelectedFile(file);
    setError("");
    setProblemsOpen(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) handleFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
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

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: active ? "var(--ink-primary)" : "var(--ink-tertiary)",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    padding: "6px 0",
    cursor: active ? "default" : "pointer",
    transition: "color 0.15s ease",
  });

  return (
    <Modal open={open} onClose={phase === "validating" || phase === "importing" ? () => {} : onClose} title="Import / Export Excel">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── Tab bar ── */}
        <div style={{ display: "flex", gap: 20, borderBottom: "1px solid var(--rule)" }} role="tablist">
          <button
            role="tab"
            aria-selected={tab === "import"}
            aria-controls="tab-import"
            onClick={() => { if (tab !== "import") setTab("import"); setError(""); }}
            style={tabStyle(tab === "import")}
          >
            Import
          </button>
          <button
            role="tab"
            aria-selected={tab === "export"}
            aria-controls="tab-export"
            onClick={() => { if (tab !== "export") { setTab("export"); setError(""); } }}
            style={tabStyle(tab === "export")}
          >
            Export
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <p role="alert" style={{ fontSize: 12, color: "#B91C1C", margin: 0 }}>{error}</p>
        )}

        {/* ════════════════════════════════════════════════════════════════
            IMPORT TAB
            ════════════════════════════════════════════════════════════════ */}
        {tab === "import" && (
          <div id="tab-import" role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* ── Idle: file dropzone ── */}
            {phase === "idle" && !selectedFile && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
                aria-label="Drop an Excel file here or click to browse"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "28px 16px",
                  border: dragOver ? "1px solid var(--accent)" : "1px dashed var(--rule-strong)",
                  borderRadius: 4,
                  background: dragOver ? "var(--accent-bg)" : "var(--ground)",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease, background 0.15s ease",
                  textAlign: "center",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dragOver ? "var(--accent)" : "var(--ink-tertiary)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ fontSize: 13, color: "var(--ink-secondary)", fontWeight: 500 }}>
                  {dragOver ? "Drop file here" : "Drop your Excel file here"}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                  or <span style={{ color: "var(--accent)", textDecoration: "underline" }}>browse</span> to choose
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-tertiary)", fontStyle: "italic", marginTop: 2 }}>
                  .xlsx / .xls · two sheets: {`"Export"`} and {`"Special Tasks"`}
                </span>
              </div>
            )}

            {/* ── Idle: selected file ── */}
            {phase === "idle" && selectedFile && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "var(--ground)",
                    border: "1px solid var(--rule)",
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-primary)" }}>{selectedFile.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>{formatBytes(selectedFile.size)}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Remove file"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    onClick={handleDownloadTemplate}
                    style={{
                      fontSize: 12,
                      color: "var(--ink-tertiary)",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Download template
                  </button>
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
                    }}
                  >
                    Validate File
                  </button>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f) handleFileSelect(f); }}
                  style={{ display: "none" }}
                />
              </div>
            )}

            {/* ── Idle: no file yet — template link ── */}
            {phase === "idle" && !selectedFile && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f) handleFileSelect(f); }}
                  style={{ display: "none" }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
                  style={{
                    fontSize: 12,
                    color: "var(--ink-tertiary)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Download template
                </button>
              </div>
            )}

            {/* ── Validating ── */}
            {phase === "validating" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "var(--ink-secondary)", fontVariantNumeric: "tabular-nums" }}>
                  Reading file&thinsp;&hellip;{progress.total > 0 && <>{progress.processed} / {progress.total} rows</>}
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
                  <div className="impeccable-progress-stripe" style={{ height: "100%", width: "100%", borderRadius: 3 }} />
                </div>
              </div>
            )}

            {/* ── Preview ── */}
            {phase === "preview" && preview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Heading */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                    Preview of <strong>{preview.totalRows}</strong> rows parsed
                  </span>
                </div>

                {/* Count table */}
                <div
                  style={{
                    background: "var(--ground)",
                    border: "1px solid var(--rule)",
                    borderRadius: 3,
                    padding: "12px 14px",
                    fontSize: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                  }}
                >
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-tertiary)", margin: "0 0 6px 0" }}>
                    Ready to import
                  </p>
                  {[
                    { label: "Frameworks", value: preview.frameworks },
                    { label: "Programs", value: preview.programs },
                    { label: "Projects", value: preview.projects },
                    { label: "Tasks", value: preview.tasks },
                    { label: "Special tasks", value: preview.specialTasks },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderTop: item.label === "Frameworks" ? "none" : "1px solid var(--rule)",
                      }}
                    >
                      <span style={{ color: item.value > 0 ? "var(--ink-secondary)" : "var(--ink-tertiary)", fontStyle: item.value > 0 ? "normal" : "italic" }}>
                        {item.label}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: item.value > 0 ? "var(--ink-primary)" : "var(--ink-tertiary)" }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                  {totalImport === 0 && preview.problems.length === 0 && (
                    <p style={{ margin: "8px 0 0", color: "var(--ink-tertiary)", fontStyle: "italic" }}>
                      Nothing new to import (all rows match existing data)
                    </p>
                  )}
                </div>

                {/* Hints for missing sheets */}
                {!preview.hasTaskSheet && preview.tasks === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: "var(--ink-tertiary)", fontStyle: "italic" }}>
                    No task rows found in file
                  </p>
                )}
                {!preview.hasSpecialTasksSheet && preview.specialTasks === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: "var(--ink-tertiary)", fontStyle: "italic" }}>
                    No &lsquo;Special Tasks&rsquo; rows found in file
                  </p>
                )}

                {/* Problems */}
                {preview.problems.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                      onClick={() => setProblemsOpen(!problemsOpen)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#B91C1C",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="currentColor"
                        style={{ transform: problemsOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s ease" }}
                      >
                        <path d="M3 1l4 4-4 4" />
                      </svg>
                      {preview.problems.length} row{preview.problems.length !== 1 ? "s" : ""} will not be imported
                    </button>
                    {problemsOpen && (
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
                    )}
                  </div>
                )}

                {/* Footer */}
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
                    onClick={handleResetImport}
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
                    Back
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
                    Import {totalImport > 0 ? `${totalImport} item${totalImport !== 1 ? "s" : ""}` : "items"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Importing ── */}
            {phase === "importing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "var(--ink-secondary)", fontVariantNumeric: "tabular-nums" }}>
                  {progress.total > 0
                    ? <>Importing&thinsp;&hellip;&thinsp;{progressPct}% done ({progress.processed} / {progress.total} rows)</>
                    : <>Preparing import&thinsp;&hellip;</>}
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
                  {progress.total > 0
                    ? <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--accent)", borderRadius: 3, transition: "width 0.15s ease" }} />
                    : <div className="impeccable-progress-stripe" style={{ height: "100%", width: "100%", borderRadius: 3 }} />}
                </div>
              </div>
            )}

            {/* ── Done ── */}
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
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A6B3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span style={{ fontWeight: 600, color: "#1A6B3C" }}>Import Complete</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {result.frameworksCreated > 0 && <p style={{ margin: 0 }}>Frameworks created: {result.frameworksCreated}</p>}
                  {result.programsCreated > 0 && <p style={{ margin: 0 }}>Programs created: {result.programsCreated}</p>}
                  {result.projectsCreated > 0 && <p style={{ margin: 0 }}>Projects created: {result.projectsCreated}</p>}
                  {result.tasksCreated > 0 && <p style={{ margin: 0 }}>Tasks created: {result.tasksCreated}</p>}
                  {result.specialTasksCreated > 0 && <p style={{ margin: 0 }}>Special tasks created: {result.specialTasksCreated}</p>}
                </div>

                {result.tasksSkipped > 0 && <p style={{ margin: 0, color: "#92400E" }}>Tasks skipped (duplicates): {result.tasksSkipped}</p>}
                {result.specialTasksSkipped > 0 && <p style={{ margin: 0, color: "#92400E" }}>Special tasks skipped (duplicates): {result.specialTasksSkipped}</p>}
                {result.rowsSkipped > 0 && <p style={{ margin: 0, color: "#92400E" }}>Rows skipped (errors): {result.rowsSkipped}</p>}

                {result.errors.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontWeight: 500, color: "#B91C1C", margin: "0 0 4px" }}>Errors:</p>
                    <ul
                      style={{
                        listStyleType: "disc",
                        paddingLeft: 20,
                        color: "#B91C1C",
                        fontSize: 11,
                        maxHeight: 120,
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

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={handleResetImport}
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
                    Import Another
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      padding: "7px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#FFFFFF",
                      background: "var(--accent)",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            EXPORT TAB
            ════════════════════════════════════════════════════════════════ */}
        {tab === "export" && (
          <div id="tab-export" role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: 0 }}>
              Export all existing tasks (including archived) to an Excel file.
            </p>

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: 16,
                padding: "10px 14px",
                background: "var(--ground)",
                border: "1px solid var(--rule)",
                borderRadius: 3,
              }}
            >
              {exportCountsLoading && !exportCounts ? (
                <>
                  <div style={{ height: 14, width: 80, borderRadius: 2, background: "var(--rule)" }} />
                  <div style={{ height: 14, width: 110, borderRadius: 2, background: "var(--rule)" }} />
                </>
              ) : exportCounts ? (
                <>
                  <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--ink-primary)" }}>{exportCounts.tasks}</span>{" "}
                    task{exportCounts.tasks !== 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--ink-primary)" }}>{exportCounts.specialTasks}</span>{" "}
                    special task{exportCounts.specialTasks !== 1 ? "s" : ""}
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "var(--ink-tertiary)", fontStyle: "italic" }}>No data</span>
              )}
            </div>

            <p style={{ fontSize: 11, color: "var(--ink-tertiary)", margin: 0 }}>
              Includes archived records.
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
                width: "fit-content",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {exporting ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="impeccable-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Exporting…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Excel (.xlsx)
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid var(--rule)" }}>
          {(phase === "idle" || phase === "done") && (
            <button
              type="button"
              onClick={phase === "done" ? handleResetImport : onClose}
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
