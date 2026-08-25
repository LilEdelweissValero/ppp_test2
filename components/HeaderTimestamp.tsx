"use client";

import { useRouter, useSearchParams } from "next/navigation";
import LastUpdated from "@/components/LastUpdated";

export default function HeaderTimestamp({
  iso,
  historicalTimestamp,
  onTimeSelect,
}: {
  iso: string | null;
  historicalTimestamp?: string | null;
  onTimeSelect?: (timestamp: string | null) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHistorical = !!historicalTimestamp;

  function handleTimeSelect(timestamp: string | null) {
    if (onTimeSelect) {
      onTimeSelect(timestamp);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (timestamp) {
      params.set("asOf", timestamp);
    } else {
      params.delete("asOf");
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : window.location.pathname);
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.02em",
        cursor: "pointer",
        userSelect: "none",
        transition: "all 0.15s ease",
        ...(isHistorical
          ? {
              background: "rgba(234, 179, 8, 0.15)",
              border: "1px solid rgba(234, 179, 8, 0.45)",
              color: "#facc15",
              boxShadow: "0 0 8px rgba(234, 179, 8, 0.2)",
            }
          : {
              background: "rgba(247, 248, 250, 0.08)",
              border: "1px solid rgba(247, 248, 250, 0.15)",
              color: "rgba(247, 248, 250, 0.7)",
            }),
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: isHistorical ? "rgba(250, 204, 21, 0.8)" : "rgba(247, 248, 250, 0.4)",
        }}
      >
        {isHistorical ? "AS OF" : "LAST UPDATED"}
      </span>
      <span
        style={{
          width: 1,
          height: 12,
          background: isHistorical ? "rgba(250, 204, 21, 0.25)" : "rgba(247, 248, 250, 0.15)",
          display: "inline-block",
        }}
      />
      <LastUpdated
        iso={iso}
        historicalTimestamp={historicalTimestamp}
        onTimeSelect={handleTimeSelect}
      />
    </div>
  );
}
