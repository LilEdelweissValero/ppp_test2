"use client";

import { useState, useRef, useEffect } from "react";

interface DateTimePickerProps {
  onApply: (timestamp: string) => void;
  onGoLive: () => void;
  currentLabel: string;
}

export default function DateTimePicker({
  onApply,
  onGoLive,
  currentLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function formatForInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}`;
  }

  function handleOpen() {
    if (!open) {
      setDraft(formatForInput(new Date()));
    }
    setOpen(!open);
  }

  function handleApply() {
    if (draft) {
      onApply(new Date(draft).toISOString());
      setOpen(false);
    }
  }

  function handleGoLive() {
    onGoLive();
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleApply();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: "inherit",
          fontFamily: "inherit",
          color: "inherit",
          letterSpacing: "inherit",
          textDecoration: "none",
          borderBottom: "1px dashed rgba(247,248,250,0.3)",
          lineHeight: "inherit",
        }}
        title="Click to choose a point in time"
      >
        {currentLabel}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: 4,
            boxShadow: "0 4px 16px rgba(15,17,23,0.12), 0 1px 4px rgba(15,17,23,0.08)",
            padding: 16,
            zIndex: 100,
            width: 280,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
          onKeyDown={handleKeyDown}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            View as of
          </div>

          <input
            type="datetime-local"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            style={{
              border: "1px solid var(--rule)",
              borderRadius: 3,
              padding: "6px 8px",
              fontSize: 13,
              color: "var(--ink-primary)",
              background: "var(--surface)",
              width: "100%",
              fontFamily: "var(--font-mono)",
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleApply}
              disabled={!draft}
              style={{
                flex: 1,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                border: "1px solid var(--accent)",
                borderRadius: 3,
                background: "var(--accent)",
                color: "#fff",
                cursor: draft ? "pointer" : "default",
                opacity: draft ? 1 : 0.5,
              }}
            >
              Apply
            </button>
            <button
              onClick={handleGoLive}
              style={{
                flex: 1,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                border: "1px solid var(--rule)",
                borderRadius: 3,
                background: "var(--surface)",
                color: "var(--ink-primary)",
                cursor: "pointer",
              }}
            >
              Now
            </button>
          </div>

          <div style={{ fontSize: 10, color: "var(--ink-tertiary)", lineHeight: 1.4 }}>
            Shows data from the chosen point in time. Like visiting a commit.
          </div>
        </div>
      )}
    </span>
  );
}
