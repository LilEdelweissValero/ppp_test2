"use client";

import { useRouter, useSearchParams } from "next/navigation";
import LastUpdated from "@/components/LastUpdated";

export default function HeaderTimestamp({
  iso,
  historicalTimestamp,
}: {
  iso: string | null;
  historicalTimestamp?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHistorical = !!historicalTimestamp;

  function handleTimeSelect(timestamp: string | null) {
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
        fontSize: 11,
        color: "rgba(247,248,250,0.35)",
        letterSpacing: "0.03em",
      }}
    >
      <span style={{ color: "rgba(247,248,250,0.22)", marginRight: 6 }}>
        {isHistorical ? "PROGRESS AS OF" : "LAST UPDATED"}
      </span>
      <LastUpdated
        iso={iso}
        historicalTimestamp={historicalTimestamp}
        onTimeSelect={handleTimeSelect}
      />
    </div>
  );
}
