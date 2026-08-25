"use client";

import { Suspense } from "react";
import HeaderTimestamp from "@/components/HeaderTimestamp";

function ProjectTimeTravelInner({
  iso,
  historicalTimestamp,
}: {
  iso: string | null;
  historicalTimestamp?: string | null;
}) {
  return (
    <HeaderTimestamp iso={iso} historicalTimestamp={historicalTimestamp} />
  );
}

export default function ProjectTimeTravel({
  iso,
  historicalTimestamp,
}: {
  iso: string | null;
  historicalTimestamp?: string | null;
}) {
  return (
    <Suspense fallback={null}>
      <ProjectTimeTravelInner iso={iso} historicalTimestamp={historicalTimestamp} />
    </Suspense>
  );
}
