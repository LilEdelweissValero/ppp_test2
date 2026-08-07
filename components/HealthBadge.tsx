"use client";

import { HealthStatus } from "@/lib/health";

const COLORS: Record<HealthStatus, string> = {
  Completed: "bg-green-100 text-green-800",
  "Not Yet Due": "",
  "On Time": "bg-green-100 text-green-700",
  "At Risk": "bg-red-100 text-red-700",
  Delayed: "bg-blue-100 text-blue-700",
};

export default function HealthBadge({ health }: { health: HealthStatus | null }) {
  if (!health) return <span className="text-gray-400 text-xs">—</span>;
  const color = COLORS[health as HealthStatus];
  if (!color) {
    return <span className="text-xs text-gray-600">{health}</span>;
  }
  const isAtRisk = health === "At Risk";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {isAtRisk && "\u26A0 "}
      {health}
    </span>
  );
}
