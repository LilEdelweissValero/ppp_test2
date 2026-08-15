"use client";

export default function LastUpdated({ iso }: { iso: string | null }) {
  if (!iso) return <span>Never</span>;
  const date = new Date(iso);
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
  return <span>{formatted}</span>;
}
