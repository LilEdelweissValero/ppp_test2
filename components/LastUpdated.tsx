"use client";

import DateTimePicker from "@/components/DateTimePicker";

interface LastUpdatedProps {
  iso: string | null;
  historicalTimestamp?: string | null;
  onTimeSelect?: (timestamp: string | null) => void;
}

export default function LastUpdated({
  iso,
  historicalTimestamp,
  onTimeSelect,
}: LastUpdatedProps) {
  const isHistorical = !!historicalTimestamp;
  const displayIso = isHistorical ? historicalTimestamp : iso;

  if (!displayIso) return <span style={{ fontSize: 12, fontWeight: 600 }}>Never</span>;

  const date = new Date(displayIso);
  const formatted =
    date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  if (!onTimeSelect) {
    return (
      <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {formatted}
      </span>
    );
  }

  return (
    <DateTimePicker
      currentLabel={formatted}
      onApply={(ts) => onTimeSelect(ts)}
      onGoLive={() => onTimeSelect(null)}
    />
  );
}
