"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 17, 23, 0.5)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={ref}
        style={{
          background: "var(--surface)",
          borderRadius: 4,
          boxShadow: "0 4px 16px rgba(15,17,23,0.12), 0 1px 4px rgba(15,17,23,0.08)",
          width: "100%",
          maxWidth: wide ? "48rem" : "32rem",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--rule)",
            padding: "16px 24px",
          }}
        >
          <h2
            id="modal-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: "var(--ink-primary)",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--ink-tertiary)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div
          style={{
            padding: 24,
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
