"use client";

import { HealthStatus } from "@/lib/health";

const HEALTH_STYLES: Record<
  HealthStatus,
  { bg: string; ink: string; dot: string; label: string }
> = {
  Completed: {
    bg: "var(--health-completed-bg)",
    ink: "var(--health-completed-ink)",
    dot: "#1A6B3C",
    label: "Completed",
  },
  "On Time": {
    bg: "var(--health-ontime-bg)",
    ink: "var(--health-ontime-ink)",
    dot: "#1A6B3C",
    label: "On Time",
  },
  "At Risk": {
    bg: "var(--health-atrisk-bg)",
    ink: "var(--health-atrisk-ink)",
    dot: "#B91C1C",
    label: "At Risk",
  },
  Delayed: {
    bg: "var(--health-delayed-bg)",
    ink: "var(--health-delayed-ink)",
    dot: "#1D4BAA",
    label: "Delayed",
  },
  "Not Yet Due": {
    bg: "var(--health-notdue-bg)",
    ink: "var(--health-notdue-ink)",
    dot: "#8896A8",
    label: "Not Yet Due",
  },
};

export default function HealthBadge({
  health,
}: {
  health: HealthStatus | null;
}) {
  if (!health) {
    return (
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-tertiary)",
          letterSpacing: "0.02em",
        }}
      >
        —
      </span>
    );
  }

  const s = HEALTH_STYLES[health];
  if (!s) {
    return (
      <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>
        {health}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        background: s.bg,
        color: s.ink,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        borderRadius: 2,
        whiteSpace: "nowrap",
        minWidth: 108,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}
