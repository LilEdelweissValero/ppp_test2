/*
  THESIS: A portfolio delivery authority surface organized as a structured
  document — not an enterprise SaaS table. Refuses the gray-header table
  pattern in favor of the architectural gantt-sheet grammar: framework spines
  as left-side color bands, tracked uppercase column headers, metric zone
  contrast against identity zone, program sub-groupings as named ruled rows.

  OWN-WORLD: Near-white drafting-paper ground (#F7F8FA), framework color as
  left-spine band (not header background), near-black ink hierarchy,
  restrained accent blue for interactive state, two ground zones (identity /
  metric) differentiated by surface value.

  STORY: Manager arrives → selects quarter → scans framework spines for
  program health → reads project row for counts and health badge → clicks into
  detail.

  FIRST VIEWPORT: Toolbar (quarter filter + search left; Actions menu right)
  then framework sections stacked vertically, each with left color spine,
  framework name + summary, programs as ruled sub-groups, project rows.

  FORM: #5 Architectural drawing / quarterly gantt sheet, staging #3
  (directory / numbered vertical stack). Seed key: ec700935.
*/

"use client";

import { useState, useMemo, useRef, useEffect, useDeferredValue } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  computeProjectPercentComplete,
  computeProjectHealth,
  computeProjectDerivedStatus,
} from "@/lib/health";
import { countTasksByStatus, countTasksByStatusForQuarter, STATUS_SCORES } from "@/lib/status";
import { compareQuarters } from "@/lib/quarters";
import HealthBadge from "@/components/HealthBadge";
import ProjectFormModal from "@/components/ProjectFormModal";
import ManageFrameworksModal from "@/components/ManageFrameworksModal";
import ManageProgramsModal from "@/components/ManageProgramsModal";
import ImportExcelModal from "@/components/ImportExcelModal";
import HistoryLogModal from "@/components/HistoryLogModal";
import { usePortfolioCache } from "@/components/PortfolioCacheProvider";

// ── Types ──────────────────────────────────────────────────────────────────

interface Task {
  id: number;
  taskCode: string;
  name: string;
  assignee: string | null;
  priority: string;
  status: string;
  description: string | null;
  targetQuarter: string;
  notes: string | null;
  deliverable: string | null;
  attachmentUrl: string | null;
  dependencies: string | null;
  adjustedTargetQuarter: string;
}

interface Project {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  actualCompletionDate: string | null;
  tasks: Task[];
  // Populated at render time from parent program
  programName?: string;
}

interface Program {
  id: number;
  name: string;
  frameworkId: number;
  projects: Project[];
}

interface Framework {
  id: number;
  name: string;
  color: string;
  programs: Program[];
}

interface Props {
  frameworks: Framework[];
  existingQuarters: string[];
  sourceVersion: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_TIME = "all";

// Short column labels (keep scannable in dense header)
const STATUS_COLS = [
  { key: "Not Yet Started", label: "NYS", title: "Not Yet Started", color: "#8896A8" },
  { key: "In Progress, Planning or Initiated", label: "Plan.", title: "Planning / Initiated", color: "#1D4BAA" },
  { key: "In Progress, Partial", label: "Part.", title: "In Progress, Partial", color: "#8B5200" },
  { key: "In Progress, Mostly Done or Testing", label: "Mostly", title: "Mostly Done / Testing", color: "#0A5FA8" },
  { key: "Complete or Verified", label: "Done", title: "Complete or Verified", color: "#1A6B3C" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function filterTasksByQuarter(tasks: Task[], selectedQuarter: string): Task[] {
  if (selectedQuarter === ALL_TIME) return tasks;
  return tasks.filter((t) => t.adjustedTargetQuarter === selectedQuarter);
}

// ── Sort helpers ───────────────────────────────────────────────────────────

type SortConfig = { key: string; direction: "asc" | "desc" } | null;

const HEALTH_ORDINAL: Record<string, number> = {
  Completed: 0,
  "On Time": 1,
  "At Risk": 2,
  Delayed: 3,
  "Not Yet Due": 4,
};

const PRIORITY_ORDINAL: Record<string, number> = {
  Low: 0,
  Moderate: 1,
  High: 2,
};

function compareSortValues(
  a: string | number | null,
  b: string | number | null,
  type: "text" | "numeric" | "quarter" | "status" | "priority" | "health" | "date"
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  switch (type) {
    case "text":
      return String(a).localeCompare(String(b));
    case "numeric":
      return (a as number) - (b as number);
    case "quarter":
      return compareQuarters(String(a), String(b));
    case "status":
      return (STATUS_SCORES[a as keyof typeof STATUS_SCORES] ?? 0) - (STATUS_SCORES[b as keyof typeof STATUS_SCORES] ?? 0);
    case "priority":
      return (PRIORITY_ORDINAL[String(a)] ?? 0) - (PRIORITY_ORDINAL[String(b)] ?? 0);
    case "health":
      return (HEALTH_ORDINAL[String(a)] ?? 5) - (HEALTH_ORDINAL[String(b)] ?? 5);
    case "date":
      return String(a).localeCompare(String(b));
    default:
      return 0;
  }
}

function getSortValue(
  project: Project,
  key: string,
  selectedQuarter: string
): string | number | null {
  const allTasks = project.tasks;
  const filteredTasks = filterTasksByQuarter(allTasks, selectedQuarter);
  const counts =
    selectedQuarter === ALL_TIME
      ? countTasksByStatus(allTasks)
      : countTasksByStatusForQuarter(allTasks, selectedQuarter);
  switch (key) {
    case "name": return project.name;
    case "programName": return project.programName ?? "";
    case "reference": return project.reference ?? "";
    case "owner": return project.owner ?? "";
    case "taskCount": return filteredTasks.length;
    case "count_nys": return counts["Not Yet Started"];
    case "count_plan": return counts["In Progress, Planning or Initiated"];
    case "count_part": return counts["In Progress, Partial"];
    case "count_mostly": return counts["In Progress, Mostly Done or Testing"];
    case "count_done": return counts["Complete or Verified"];
    case "plannedQ": return project.targetQuarter;
    case "dueQ": return project.adjustedTargetQuarter;
    case "completionDate": return project.actualCompletionDate ?? "";
    case "status": return computeProjectDerivedStatus(filteredTasks);
    case "pct": return Math.round(computeProjectPercentComplete(filteredTasks) * 100);
    case "health": {
      const pct = computeProjectPercentComplete(filteredTasks) * 100;
      if (filteredTasks.length === 0) return "";
      return computeProjectHealth(pct, project.adjustedTargetQuarter) ?? "";
    }
    default: return "";
  }
}

const SORT_TYPE_MAP: Record<string, "text" | "numeric" | "quarter" | "status" | "priority" | "health" | "date"> = {
  name: "text", programName: "text", reference: "text", owner: "text",
  taskCount: "numeric", count_nys: "numeric", count_plan: "numeric",
  count_part: "numeric", count_mostly: "numeric", count_done: "numeric",
  plannedQ: "quarter", dueQ: "quarter", completionDate: "date",
  status: "text", pct: "numeric", health: "health",
};

// ── Grip icon ─────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      {[0, 4, 8].map((cy) =>
        [0, 5].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx + 2} cy={cy + 3} r={1.2} fill="currentColor" />
        ))
      )}
    </svg>
  );
}

// ── Status micro-bar for summary rows ────────────────────────────────────

function StatusMiniBar({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  if (total === 0) {
    return <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>—</span>;
  }
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "center", height: 8 }}>
      {STATUS_COLS.map((sc) => {
        const pct = total > 0 ? (counts[sc.key] ?? 0) / total : 0;
        if (pct === 0) return null;
        return (
          <div
            key={sc.key}
            title={`${sc.title}: ${counts[sc.key]}`}
            style={{
              height: 8,
              width: Math.max(3, pct * 80),
              background: sc.color,
              opacity: 0.75,
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Column header row ─────────────────────────────────────────────────────

function TableHeader({
  sortConfig,
  onSort,
}: {
  sortConfig: SortConfig;
  onSort: (key: string) => void;
}) {
  const thStyle = (isMetric: boolean): React.CSSProperties => ({
    padding: "7px 10px",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: isMetric ? "var(--ink-secondary)" : "var(--ink-on-dark)",
    background: isMetric ? "var(--ground-metric)" : "var(--ink-primary)",
    borderBottom: `1px solid ${isMetric ? "var(--rule-strong)" : "rgba(255,255,255,0.10)"}`,
    whiteSpace: "nowrap" as const,
    textAlign: "left" as const,
    verticalAlign: "bottom",
  });

  const thCenter = (isMetric: boolean): React.CSSProperties => ({
    ...thStyle(isMetric),
    textAlign: "center",
  });

  function sortableTh(
    label: string,
    sortKey: string,
    baseStyle: React.CSSProperties,
    extra?: React.CSSProperties
  ) {
    const active = sortConfig?.key === sortKey;
    const arrow = active ? (sortConfig!.direction === "asc" ? " \u25B2" : " \u25BC") : "";
    return (
      <th
        key={sortKey}
        style={{
          ...baseStyle,
          cursor: "pointer",
          userSelect: "none",
          ...extra,
        }}
        onClick={() => onSort(sortKey)}
        title={label}
      >
        {label}
        {arrow && (
          <span style={{ fontSize: 7, marginLeft: 2, opacity: active ? 1 : 0.3 }}>
            {arrow}
          </span>
        )}
      </th>
    );
  }

  return (
    <thead>
      <tr>
        {/* drag handle — not sortable */}
        <th style={{ ...thStyle(false), width: 32, padding: "7px 8px" }} />
        {/* identity zone */}
        {sortableTh("Project", "name", thStyle(false), { width: 220 })}
        {sortableTh("Program", "programName", thStyle(false), { width: 150 })}
        {sortableTh("Reference", "reference", thStyle(false), { width: 100 })}
        {sortableTh("Owner", "owner", thStyle(false), { width: 110, borderRight: "1px solid rgba(255,255,255,0.15)" })}
        {/* metric zone */}
        {sortableTh("#", "taskCount", thCenter(true), { width: 56 })}
        {STATUS_COLS.map((sc, i) => {
          const keys = ["count_nys", "count_plan", "count_part", "count_mostly", "count_done"];
          return sortableTh(sc.label, keys[i], thCenter(true), { width: 56 });
        })}
        {sortableTh("Planned Q", "plannedQ", thStyle(true), { width: 88 })}
        {sortableTh("Due Q", "dueQ", thStyle(true), { width: 88 })}
        {sortableTh("Completion Date", "completionDate", thStyle(true), { width: 90 })}
        {sortableTh("Status", "status", thStyle(true), { width: 80 })}
        {sortableTh("%", "pct", thCenter(true), { width: 64 })}
        {sortableTh("Health", "health", thStyle(true), { width: 110 })}
      </tr>
    </thead>
  );
}

// ── Program summary row ───────────────────────────────────────────────────

function ProgramSummaryRow({
  program,
  selectedQuarter,
  accentColor,
}: {
  program: Program;
  selectedQuarter: string;
  accentColor: string;
}) {
  const allTasks = program.projects.flatMap((p) => p.tasks);
  const filteredTasks = filterTasksByQuarter(allTasks, selectedQuarter);
  const counts =
    selectedQuarter === ALL_TIME
      ? countTasksByStatus(allTasks)
      : countTasksByStatusForQuarter(allTasks, selectedQuarter);
  const total = filteredTasks.length;

  // Aggregate program-level metrics from projects (mean of project %'s)
  const projectPcts = program.projects
    .map((p) => {
      const ft = filterTasksByQuarter(p.tasks, selectedQuarter);
      return ft.length > 0 ? computeProjectPercentComplete(ft) : null;
    })
    .filter((p): p is number => p !== null);
  const programPct = projectPcts.length > 0
    ? projectPcts.reduce((a, b) => a + b, 0) / projectPcts.length
    : 0;
  const programPctRounded = Math.round(programPct * 100);
  const programDerivedStatus = computeProjectDerivedStatus(filteredTasks);

  // Planned Q: earliest targetQuarter across projects
  const plannedQ = program.projects.length > 0
    ? program.projects.reduce((earliest, p) =>
        p.targetQuarter < earliest ? p.targetQuarter : earliest,
        program.projects[0].targetQuarter
      )
    : "—";

  // Due Q: latest adjustedTargetQuarter across projects
  const dueQ = program.projects.length > 0
    ? program.projects.reduce((latest, p) =>
        p.adjustedTargetQuarter > latest ? p.adjustedTargetQuarter : latest,
        program.projects[0].adjustedTargetQuarter
      )
    : "—";

  // Completion date: only show if ALL projects are fully complete
  const allProjectsComplete = program.projects.length > 0 &&
    program.projects.every((p) =>
      p.tasks.length > 0 && p.tasks.every((t) => t.status === "Complete or Verified")
    );
  const completionDate = allProjectsComplete
    ? program.projects
        .map((p) => p.actualCompletionDate)
        .filter((d): d is string => d !== null)
        .sort()
        .pop() || null
    : null;

  // Health: computed from program % and latest due quarter
  const programHealth =
    filteredTasks.length > 0
      ? computeProjectHealth(programPctRounded, dueQ)
      : null;

  const programBg = `color-mix(in srgb, ${accentColor} 75%, white)`;

  return (
    <tr
      style={{
        background: `color-mix(in srgb, ${accentColor} 10%, var(--ground-metric))`,
        borderTop: "1px solid var(--rule-strong)",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      {/* spacer for drag handle */}
      <td style={{ padding: "5px 8px" }} />
      {/* program name spanning identity cols */}
      <td
        colSpan={4}
        style={{
          padding: "5px 10px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-secondary)",
          borderRight: "1px solid var(--rule-strong)",
        }}
      >
        {program.name}
      </td>
      {/* total */}
      <td
        style={{
          padding: "5px 10px",
          textAlign: "center",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink-secondary)",
          background: programBg,
          fontWeight: 600,
        }}
      >
        {total}
      </td>
      {/* status counts */}
      {STATUS_COLS.map((sc) => (
        <td
          key={sc.key}
          style={{
            padding: "5px 10px",
            textAlign: "center",
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            color: counts[sc.key] > 0 ? sc.color : "var(--ink-tertiary)",
            fontWeight: counts[sc.key] > 0 ? 600 : 400,
            background: programBg,
          }}
        >
          {counts[sc.key]}
        </td>
      ))}
      {/* planned quarter */}
      <td
        style={{
          padding: "5px 10px",
          textAlign: "left",
          width: 88,
          fontSize: 11,
          color: "var(--ink-tertiary)",
          background: programBg,
        }}
      >
        {plannedQ}
      </td>
      {/* due quarter */}
      <td
        style={{
          padding: "5px 10px",
          textAlign: "left",
          width: 88,
          fontSize: 11,
          fontWeight: dueQ !== plannedQ ? 600 : 400,
          color: dueQ === plannedQ ? "var(--ink-tertiary)" : "var(--ink-secondary)",
          fontStyle: dueQ === plannedQ ? "italic" : "normal",
          background: programBg,
        }}
      >
        {dueQ === plannedQ ? "as planned" : dueQ}
      </td>
      {/* completion date */}
      <td
        style={{
          padding: "5px 10px",
          textAlign: "left",
          width: 90,
          fontSize: 11,
          color: completionDate ? "var(--ink-secondary)" : "var(--rule-strong)",
          background: programBg,
        }}
      >
        {completionDate || "—"}
      </td>
      {/* derived status */}
      <td style={{ padding: "5px 10px", textAlign: "left", width: 80, background: programBg }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color:
              programDerivedStatus === "Completed"
                ? "var(--health-completed-ink)"
                : "var(--ink-secondary)",
          }}
        >
          {programDerivedStatus}
        </span>
      </td>
      {/* percent complete */}
      <td style={{ padding: "5px 10px", textAlign: "center", width: 64, background: programBg }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color:
              programPctRounded === 100
                ? "var(--health-completed-ink)"
                : "var(--ink-primary)",
          }}
        >
          {programPctRounded}%
        </span>
      </td>
      {/* health badge */}
      <td style={{ padding: "5px 10px", textAlign: "left", width: 110, background: programBg }}>
        <HealthBadge health={programHealth} />
      </td>
    </tr>
  );
}

// ── Framework summary row ─────────────────────────────────────────────────

function FrameworkSummaryRow({
  framework,
  selectedQuarter,
}: {
  framework: Framework;
  selectedQuarter: string;
}) {
  const allTasks = framework.programs.flatMap((prog) =>
    prog.projects.flatMap((p) => p.tasks)
  );
  const filteredTasks = filterTasksByQuarter(allTasks, selectedQuarter);
  const counts =
    selectedQuarter === ALL_TIME
      ? countTasksByStatus(allTasks)
      : countTasksByStatusForQuarter(allTasks, selectedQuarter);
  const total = filteredTasks.length;

  return (
    <tr
      style={{
        background: "var(--ground-metric)",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <td style={{ padding: "5px 8px" }} />
      <td
        colSpan={4}
        style={{
          padding: "5px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-tertiary)",
          letterSpacing: "0.03em",
          borderRight: "1px solid var(--rule-strong)",
        }}
      >
        TOTAL
      </td>
      <td
        style={{
          padding: "5px 10px",
          textAlign: "center",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink-secondary)",
          fontWeight: 600,
        }}
      >
        {total}
      </td>
      {STATUS_COLS.map((sc) => (
        <td
          key={sc.key}
          style={{
            padding: "5px 10px",
            textAlign: "center",
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            color: counts[sc.key] > 0 ? sc.color : "var(--ink-tertiary)",
            fontWeight: counts[sc.key] > 0 ? 600 : 400,
          }}
        >
          {counts[sc.key]}
        </td>
      ))}
      <td colSpan={6} />
    </tr>
  );
}

// ── Sortable project row ───────────────────────────────────────────────────

function SortableProjectRow({
  project,
  onPrefetch,
  onNavigate,
  selectedQuarter,
  isEven,
  programName,
}: {
  project: Project;
  onPrefetch: () => void;
  onNavigate: () => void;
  selectedQuarter: string;
  isEven: boolean;
  programName: string;
}) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const filteredTasks = filterTasksByQuarter(project.tasks, selectedQuarter);

  const rowBg = hovered
    ? "var(--accent-bg)"
    : isEven
    ? "var(--surface)"
    : "var(--ground)";

  const tdBase: React.CSSProperties = {
    padding: "8px 10px",
    borderBottom: "1px solid var(--rule)",
    fontSize: 12,
    color: "var(--ink-primary)",
    background: rowBg,
    verticalAlign: "middle",
  };

  if (filteredTasks.length === 0 && selectedQuarter !== ALL_TIME) {
    return (
      <tr
        ref={setNodeRef}
        style={style}
        onMouseEnter={() => { setHovered(true); setShouldPrefetch(true); onPrefetch(); }}
        onFocus={onPrefetch}
        onMouseLeave={() => setHovered(false)}
      >
        <td style={{ ...tdBase, padding: "8px 8px", width: 32 }}>
          <button
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", color: "var(--ink-tertiary)", display: "flex", alignItems: "center", padding: 2, borderRadius: 2, background: "none", border: "none" }}
            aria-label="Drag to reorder"
          >
            <GripIcon />
          </button>
        </td>
        <td style={{ ...tdBase, width: 220 }}>
          <Link
            href={`/projects/${project.id}?cached=1`}
            prefetch={shouldPrefetch}
            onPointerEnter={onPrefetch}
            onFocus={onPrefetch}
            onTouchStart={onPrefetch}
            onNavigate={onNavigate}
            style={{ fontWeight: 600, fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
          >
            {project.name}
          </Link>
        </td>
        <td style={{ ...tdBase, width: 150, fontSize: 11, color: "var(--ink-secondary)" }}>{programName}</td>
        <td style={{ ...tdBase, width: 100, fontSize: 11, color: "var(--ink-secondary)" }}>{project.reference || "—"}</td>
        <td style={{ ...tdBase, width: 110, fontSize: 11, color: "var(--ink-secondary)" }}>{project.owner || "—"}</td>
        <td colSpan={12} style={{ ...tdBase, fontSize: 11, color: "var(--ink-tertiary)", fontStyle: "italic" }}>
          No tasks due in {selectedQuarter}
        </td>
      </tr>
    );
  }
  const pct = computeProjectPercentComplete(filteredTasks);
  const health =
    filteredTasks.length > 0
      ? computeProjectHealth(pct * 100, project.adjustedTargetQuarter)
      : null;
  const counts =
    selectedQuarter === ALL_TIME
      ? countTasksByStatus(project.tasks)
      : countTasksByStatusForQuarter(project.tasks, selectedQuarter);
  const derivedStatus = computeProjectDerivedStatus(filteredTasks);
  const pctRounded = Math.round(pct * 100);

  const metricBg = hovered
    ? "#E3EDFF"
    : isEven
    ? "#F4F6FA"
    : "var(--ground-metric)";

  const tdMetric: React.CSSProperties = {
    ...tdBase,
    background: metricBg,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: "var(--ink-secondary)",
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => {
        setHovered(true);
        setShouldPrefetch(true);
        onPrefetch();
      }}
      onFocus={onPrefetch}
      onMouseLeave={() => setHovered(false)}
    >
      {/* drag handle */}
      <td style={{ ...tdBase, padding: "8px 8px", width: 32 }}>
        <button
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            color: "var(--ink-tertiary)",
            display: "flex",
            alignItems: "center",
            padding: 2,
            borderRadius: 2,
            background: "none",
            border: "none",
          }}
          aria-label="Drag to reorder"
        >
          <GripIcon />
        </button>
      </td>

      {/* project name */}
      <td style={{ ...tdBase, width: 220 }}>
        <Link
          href={`/projects/${project.id}?cached=1`}
          prefetch={shouldPrefetch ? true : false}
          onPointerEnter={onPrefetch}
          onFocus={onPrefetch}
          onTouchStart={onPrefetch}
          onNavigate={onNavigate}
          style={{
            fontWeight: 600,
            fontSize: 12,
            color: "var(--accent)",
            cursor: "pointer",
            textAlign: "left",
            lineHeight: 1.35,
            textDecoration: "none",
          }}
        >
          {project.name}
        </Link>
      </td>

      {/* program */}
      <td style={{ ...tdBase, width: 150, color: "var(--ink-secondary)", fontSize: 11 }}>
        {programName}
      </td>

      {/* reference */}
      <td
        style={{
          ...tdBase,
          width: 100,
          color: "var(--ink-tertiary)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        }}
      >
        {project.reference || "—"}
      </td>

      {/* owner */}
      <td style={{ ...tdBase, width: 110, color: "var(--ink-secondary)", fontSize: 11, borderRight: "1px solid var(--rule-strong)" }}>
        {project.owner || "—"}
      </td>

      {/* task total */}
      <td style={{ ...tdMetric, width: 56, fontWeight: 600, color: "var(--ink-primary)" }}>
        {filteredTasks.length}
      </td>

      {/* status breakdown */}
      {STATUS_COLS.map((sc) => (
        <td
          key={sc.key}
          style={{
            ...tdMetric,
            width: 56,
            color: counts[sc.key] > 0 ? sc.color : "var(--rule-strong)",
            fontWeight: counts[sc.key] > 0 ? 600 : 400,
          }}
        >
          {counts[sc.key]}
        </td>
      ))}

      {/* planned quarter */}
      <td
        style={{
          ...tdMetric,
          textAlign: "left",
          width: 88,
          color: "var(--ink-tertiary)",
          fontSize: 11,
        }}
      >
        {project.targetQuarter}
      </td>

      {/* due quarter */}
      <td
        style={{
          ...tdMetric,
          textAlign: "left",
          width: 88,
          fontSize: 11,
          fontWeight: project.adjustedTargetQuarter !== project.targetQuarter ? 600 : 400,
          color: project.adjustedTargetQuarter === project.targetQuarter
            ? "var(--ink-tertiary)"
            : "var(--ink-secondary)",
          fontStyle: project.adjustedTargetQuarter === project.targetQuarter ? "italic" : "normal",
        }}
      >
        {project.adjustedTargetQuarter === project.targetQuarter
          ? "as planned"
          : project.adjustedTargetQuarter}
      </td>

      {/* completion date */}
      <td
        style={{
          ...tdMetric,
          textAlign: "left",
          width: 90,
          fontSize: 11,
          color: project.actualCompletionDate ? "var(--ink-secondary)" : "var(--rule-strong)",
        }}
      >
        {project.actualCompletionDate || "—"}
      </td>

      {/* derived status */}
      <td style={{ ...tdMetric, textAlign: "left", width: 80 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color:
              derivedStatus === "Completed"
                ? "var(--health-completed-ink)"
                : "var(--ink-secondary)",
          }}
        >
          {derivedStatus}
        </span>
      </td>

      {/* percent complete */}
      <td style={{ ...tdMetric, width: 64 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color:
                pctRounded === 100
                  ? "var(--health-completed-ink)"
                  : "var(--ink-primary)",
            }}
          >
            {pctRounded}%
          </span>
          {/* micro progress track */}
          <div
            style={{
              width: 36,
              height: 4,
              background: "var(--rule-strong)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background:
                  pctRounded === 100 ? "var(--health-completed-ink)" : "var(--accent)",
                borderRadius: 2,
                transform: `scaleX(${pctRounded / 100})`,
                transformOrigin: "left center",
                transition: "transform 0.3s ease-out",
              }}
            />
          </div>
        </div>
      </td>

      {/* health badge */}
      <td style={{ ...tdMetric, textAlign: "left", width: 110 }}>
        <HealthBadge health={health} />
      </td>
    </tr>
  );
}

// ── Actions dropdown ───────────────────────────────────────────────────────

function ActionsMenu({
  onManageFrameworks,
  onManagePrograms,
  onImportExcel,
  onHistoryLog,
  onViewArchive,
}: {
  onManageFrameworks: () => void;
  onManagePrograms: () => void;
  onImportExcel: () => void;
  onHistoryLog: () => void;
  onViewArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items = [
    { label: "Manage Frameworks", action: onManageFrameworks },
    { label: "Manage Programs", action: onManagePrograms },
    { label: "Import / Export Excel", action: onImportExcel },
    { label: "History Log", action: onHistoryLog },
    { label: "View Archive", action: onViewArchive },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          background: open ? "var(--ink-primary)" : "var(--surface)",
          color: open ? "var(--ink-on-dark)" : "var(--ink-primary)",
          border: "1px solid var(--rule-strong)",
          borderRadius: 3,
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          letterSpacing: "0.01em",
          transition: "background 0.12s, color 0.12s",
        }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Manage
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--rule-strong)",
            borderRadius: 4,
            boxShadow: "0 4px 16px rgba(15,17,23,0.12), 0 1px 4px rgba(15,17,23,0.08)",
            minWidth: 180,
            zIndex: 50,
            overflow: "hidden",
          }}
          role="menu"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className="actions-menu-item"
              style={{
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--ink-primary)",
                borderTop: i > 0 ? "1px solid var(--rule)" : "none",
                letterSpacing: "0.01em",
              }}
              role="menuitem"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardView({
  frameworks,
  existingQuarters,
  sourceVersion,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    getProject,
    setProject,
    seedPortfolio,
    markDashboardNavigation,
    version,
  } = usePortfolioCache();
  const [portfolio, setPortfolio] = useState(frameworks);

  const [selectedQuarter, setSelectedQuarter] = useState(searchParams.get("q") || ALL_TIME);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedQuarter === ALL_TIME) {
      params.delete("q");
    } else {
      params.set("q", selectedQuarter);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname);
  }, [selectedQuarter, router]);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [showAddProject, setShowAddProject] = useState(false);
  const [showManageFrameworks, setShowManageFrameworks] = useState(false);
  const [showManagePrograms, setShowManagePrograms] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showHistoryLog, setShowHistoryLog] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setPortfolio(frameworks);
  }, [frameworks]);

  useEffect(() => {
    seedPortfolio(frameworks, sourceVersion);
  }, [frameworks, seedPortfolio, sourceVersion]);

  // Local project ordering per framework (keyed by frameworkId)
  const [frameworkProjectsOverride, setFrameworkProjectsOverride] = useState<
    Record<number, Project[]>
  >({});

  const quarters = [ALL_TIME, ...existingQuarters];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Merge local overrides back into the framework+program tree
  const resolvedFrameworks = useMemo(() => {
    void version;
    const allProjects = portfolio.flatMap((framework) =>
      framework.programs.flatMap((program) =>
        program.projects.map((project) => {
          const cached = getProject(project.id);
          return cached ? { ...project, ...cached } : project;
        })
      )
    );
    return portfolio.map((fw) => ({
      ...fw,
      programs: fw.programs.map((prog) => {
        const projects = allProjects
          .filter((project) => project.programId === prog.id)
          .map((project) => project);
        // Apply any reorder overrides at program level
        const overriddenProjects = frameworkProjectsOverride[fw.id];
        if (overriddenProjects) {
          const order = new Map(
            overriddenProjects.map((project, index) => [project.id, index])
          );
          return {
            ...prog,
            projects: [...projects].sort(
              (left, right) =>
                (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
                (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
            ),
          };
        }
        return { ...prog, projects };
      }),
    }));
  }, [portfolio, frameworkProjectsOverride, getProject, version]);

  const programOptions = useMemo(
    () =>
      portfolio.flatMap((framework) =>
        framework.programs.map((program) => ({
          id: program.id,
          name: program.name,
          frameworkId: framework.id,
          framework: { name: framework.name },
        }))
      ),
    [portfolio]
  );

  function handleFrameworksChange(nextFrameworks: { id: number; name: string; color: string }[]) {
    setPortfolio((current) =>
      nextFrameworks.map((framework) => ({
        ...framework,
        programs:
          current.find((item) => item.id === framework.id)?.programs || [],
      }))
    );
  }

  function handleProgramsChange(
    nextPrograms: { id: number; name: string; frameworkId: number }[]
  ) {
    const renamedPrograms = new Map(
      nextPrograms.map((program) => [program.id, program.name])
    );
    for (const framework of portfolio) {
      for (const program of framework.programs) {
        const nextName = renamedPrograms.get(program.id);
        if (!nextName || nextName === program.name) continue;
        for (const project of program.projects) {
          const cached = getProject(project.id);
          if (cached) {
            setProject({
              ...cached,
              program: { ...cached.program, name: nextName },
            });
          }
        }
      }
    }
    setPortfolio((current) =>
      current.map((framework) => ({
        ...framework,
        programs: nextPrograms
          .filter((program) => program.frameworkId === framework.id)
          .map((program) => ({
            id: program.id,
            name: program.name,
            frameworkId: program.frameworkId,
            projects:
              current
                .flatMap((item) => item.programs)
                .find((item) => item.id === program.id)?.projects || [],
          })),
      }))
    );
  }

  // Filter by search (universal: matches across all visible fields)
  const filteredFrameworks = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return resolvedFrameworks;

    function taskMatches(task: Task, query: string): boolean {
      return (
        task.taskCode.toLowerCase().includes(query) ||
        task.name.toLowerCase().includes(query) ||
        (task.assignee ?? "").toLowerCase().includes(query) ||
        task.status.toLowerCase().includes(query) ||
        task.priority.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query) ||
        (task.notes ?? "").toLowerCase().includes(query) ||
        (task.deliverable ?? "").toLowerCase().includes(query)
      );
    }

    return resolvedFrameworks
      .map((fw) => ({
        ...fw,
        programs: fw.programs
          .map((prog) => ({
            ...prog,
            projects: prog.projects.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.reference ?? "").toLowerCase().includes(q) ||
                (p.owner ?? "").toLowerCase().includes(q) ||
                prog.name.toLowerCase().includes(q) ||
                fw.name.toLowerCase().includes(q) ||
                p.tasks.some((t) => taskMatches(t, q))
            ),
          }))
          .filter((prog) => prog.projects.length > 0),
      }))
      .filter((fw) => fw.programs.length > 0);
  }, [resolvedFrameworks, deferredSearch]);

  function toggleCollapse(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllCollapse() {
    const allIds = filteredFrameworks.map((f) => f.id);
    if (collapsed.size >= allIds.length) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(allIds));
    }
  }

  function handleRefresh() {
    router.refresh();
  }

  function handleSort(key: string) {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      const numericKeys = new Set(["taskCount", "count_nys", "count_plan", "count_part", "count_mostly", "count_done", "pct"]);
      return { key, direction: numericKeys.has(key) ? "desc" : "asc" };
    });
  }

  async function handleProjectDragEnd(fwId: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fw = resolvedFrameworks.find((f) => f.id === fwId);
    if (!fw) return;
    const allProjects = fw.programs.flatMap((p) => p.projects);
    const oldIndex = allProjects.findIndex((p) => p.id === active.id);
    const newIndex = allProjects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(allProjects, oldIndex, newIndex);

    setFrameworkProjectsOverride((prev) => ({ ...prev, [fwId]: reordered }));

    try {
      const response = await fetch("/api/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "project",
          orderedIds: reordered.map((p) => p.id),
        }),
      });
      if (!response.ok) throw new Error("Reorder failed");
      router.refresh();
    } catch {
      setFrameworkProjectsOverride((prev) => {
        const next = { ...prev };
        delete next[fwId];
        return next;
      });
    }
  }

  const allCollapsed =
    filteredFrameworks.length > 0 &&
    collapsed.size >= filteredFrameworks.length;

  const totalFrameworks = filteredFrameworks.length;

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Quarter filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--ink-tertiary)",
            }}
          >
            Quarter
          </label>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            style={{
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              padding: "6px 28px 6px 10px",
              fontSize: 12,
              color: "var(--ink-primary)",
              background: "var(--surface)",
              cursor: "pointer",
              appearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238896A8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            {quarters.map((q) => (
              <option key={q} value={q}>
                {q === ALL_TIME ? "All Time" : q}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 200, maxWidth: 340 }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--ink-tertiary)",
            }}
          >
            Search
          </label>
          <div style={{ position: "relative" }}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              aria-hidden="true"
            >
              <circle cx="5" cy="5" r="3.5" stroke="var(--ink-tertiary)" strokeWidth="1.2" />
              <path d="M8 8l2.5 2.5" stroke="var(--ink-tertiary)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, tasks, assignees…"
              style={{
                width: "100%",
                border: "1px solid var(--rule-strong)",
                borderRadius: 3,
                padding: "6px 10px 6px 28px",
                fontSize: 12,
                color: "var(--ink-primary)",
                background: "var(--surface)",
              }}
            />
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Add Project button */}
        <button
          onClick={() => setShowAddProject(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            background: "var(--accent)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 3,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.01em",
            transition: "background 0.12s",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add Project
        </button>

        {/* Manage menu */}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <ActionsMenu
            onManageFrameworks={() => setShowManageFrameworks(true)}
            onManagePrograms={() => setShowManagePrograms(true)}
            onImportExcel={() => setShowImportExcel(true)}
            onHistoryLog={() => setShowHistoryLog(true)}
            onViewArchive={() => router.push("/archived")}
          />
        </div>
      </div>

      {/* ── Empty state ── */}
      {filteredFrameworks.length === 0 && (
        <div
          style={{
            padding: "48px 32px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: 4,
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-tertiary)",
              marginBottom: 8,
            }}
          >
            {search
              ? "No projects match your search."
              : "No frameworks or projects yet."}
          </p>
          {!search && (
            <p style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
              Click &quot;Add Project&quot; or use Manage → Import / Export Excel to get started.
            </p>
          )}
        </div>
      )}

      {/* ── Collapse controls ── */}
      {filteredFrameworks.length > 1 && (
        <div
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={toggleAllCollapse}
            style={{
              fontSize: 11,
              color: "var(--ink-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              letterSpacing: "0.03em",
            }}
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
            {totalFrameworks} framework{totalFrameworks !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Framework sections ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredFrameworks.map((fw) => {
          const isCollapsed = collapsed.has(fw.id);
          const allProjects = fw.programs.flatMap((p) => p.projects);
          const hasProjects = allProjects.length > 0;
          const hasTasksInQuarter = selectedQuarter === ALL_TIME
            ? allProjects.some((p) => p.tasks.length > 0)
            : allProjects.some((p) => p.tasks.some((t) => t.adjustedTargetQuarter === selectedQuarter));
          return (
            <div
              key={fw.id}
              style={{
              border: "1px solid var(--rule)",
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(15,17,23,0.07), 0 0 0 1px rgba(15,17,23,0.02)",
              }}
            >
              {/* ── Framework header ── */}
              <div
                onClick={() => hasProjects && hasTasksInQuarter && toggleCollapse(fw.id)}
                style={{
                  background: fw.color,
                  borderBottom: "1px solid var(--rule)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  cursor: hasProjects && hasTasksInQuarter ? "pointer" : "default",
                  userSelect: "none",
                }}
              >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {hasProjects && hasTasksInQuarter && (
                      <span
                        aria-hidden="true"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          color: "var(--ink-tertiary)",
                        }}
                      >
                        <svg
                          width="10"
                          height="6"
                          viewBox="0 0 10 6"
                          fill="none"
                          style={{
                            transform: isCollapsed ? "rotate(-90deg)" : "none",
                            transition: "transform 0.15s",
                          }}
                          aria-hidden="true"
                        >
                          <path
                            d="M1 1l4 4 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}

                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        letterSpacing: "0.04em",
                        color: "var(--ink-primary)",
                      }}
                    >
                      {fw.name}
                    </span>

                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ink-tertiary)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {fw.programs.length} program{fw.programs.length !== 1 ? "s" : ""}
                      {" · "}
                      {allProjects.length} project{allProjects.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Framework aggregate stats */}
                  {hasProjects && hasTasksInQuarter && (() => {
                    const allTasks = allProjects.flatMap((p) => p.tasks);
                    const filteredTasks = filterTasksByQuarter(allTasks, selectedQuarter);
                    const counts =
                      selectedQuarter === ALL_TIME
                        ? countTasksByStatus(allTasks)
                        : countTasksByStatusForQuarter(allTasks, selectedQuarter);
                    const total = filteredTasks.length;
                    // Framework % = mean of programs' % (each program % = mean of its projects' %)
                    const programPcts = fw.programs
                      .map((prog) => {
                        const projPcts = prog.projects
                          .map((p) => {
                            const ft = filterTasksByQuarter(p.tasks, selectedQuarter);
                            return ft.length > 0 ? computeProjectPercentComplete(ft) : null;
                          })
                          .filter((p): p is number => p !== null);
                        return projPcts.length > 0
                          ? projPcts.reduce((a, b) => a + b, 0) / projPcts.length
                          : null;
                      })
                      .filter((p): p is number => p !== null);
                    const fwPct = programPcts.length > 0
                      ? programPcts.reduce((a, b) => a + b, 0) / programPcts.length
                      : 0;
                    const fwPctRounded = Math.round(fwPct * 100);
                    const fwHealth =
                      total > 0
                        ? computeProjectHealth(fwPctRounded, allProjects.reduce((latest, p) =>
                            p.adjustedTargetQuarter > latest ? p.adjustedTargetQuarter : latest,
                            allProjects[0].adjustedTargetQuarter
                          ))
                        : null;
                    const completedCount = allProjects.filter((p) =>
                      p.tasks.length > 0 && p.tasks.every((t) => t.status === "Complete or Verified")
                    ).length;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                          {total} task{total !== 1 ? "s" : ""}
                        </span>
                        <StatusMiniBar counts={counts} total={total} />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: fwPctRounded === 100 ? "var(--health-completed-ink)" : "var(--ink-primary)",
                          }}
                        >
                          {fwPctRounded}%
                        </span>
                        <HealthBadge health={fwHealth} />
                        <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                          {completedCount}/{allProjects.length} done
                        </span>
                      </div>
                    );
                  })()}
                </div>

              {/* ── Framework table ── */}
              {!isCollapsed && hasProjects && hasTasksInQuarter && (
                <div style={{ flex: 1, overflowX: "auto" }}>
                    <DndContext
                      id={`project-sort-${fw.id}`}
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleProjectDragEnd(fw.id, event)}
                    >
                      <table
                        style={{
                          borderCollapse: "collapse",
                          width: "100%",
                          minWidth: 1280,
                        }}
                        role="table"
                      >
                        <thead>
                          <FrameworkSummaryRow
                            framework={fw}
                            selectedQuarter={selectedQuarter}
                          />
                        </thead>
                        <TableHeader sortConfig={sortConfig} onSort={handleSort} />
                        <tbody>

                          {/* Programs + their projects */}
                          {fw.programs.map((prog) => {
                            if (prog.projects.length === 0) return null;
                            const hasTasksInProgram = selectedQuarter === ALL_TIME
                              ? prog.projects.some((p) => p.tasks.length > 0)
                              : prog.projects.some((p) => p.tasks.some((t) => t.adjustedTargetQuarter === selectedQuarter));
                            if (!hasTasksInProgram) return null;
                            const sortedProjects = sortConfig
                              ? [...prog.projects].sort((a, b) => {
                                  const va = getSortValue(a, sortConfig.key, selectedQuarter);
                                  const vb = getSortValue(b, sortConfig.key, selectedQuarter);
                                  const cmp = compareSortValues(va, vb, SORT_TYPE_MAP[sortConfig.key] ?? "text");
                                  return sortConfig.direction === "asc" ? cmp : -cmp;
                                })
                              : prog.projects;
                            return (
                              <SortableContext
                                key={prog.id}
                                items={sortedProjects.map((p) => p.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {/* Program sub-header */}
                                <ProgramSummaryRow
                                  program={prog}
                                  selectedQuarter={selectedQuarter}
                                  accentColor={fw.color}
                                />
                                {/* Project rows */}
                                {sortedProjects.map((project, rowIdx) => (
                                  <SortableProjectRow
                                    key={project.id}
                                    project={project}
                                    selectedQuarter={selectedQuarter}
                                    isEven={rowIdx % 2 === 0}
                                    programName={prog.name}
                                    onPrefetch={() => router.prefetch(`/projects/${project.id}?cached=1`)}
                                    onNavigate={() => {
                                      markDashboardNavigation(project.id);
                                    }}
                                  />
                                ))}
                              </SortableContext>
                            );
                          })}
                        </tbody>
                      </table>
                    </DndContext>
                  </div>
              )}

              {/* Empty framework */}
              {!isCollapsed && !hasProjects && (
                <p
                  style={{
                    padding: "16px 20px",
                    fontSize: 12,
                    color: "var(--ink-tertiary)",
                  }}
                >
                  No projects in this framework yet.
                </p>
              )}
              {!isCollapsed && hasProjects && !hasTasksInQuarter && (
                <p
                  style={{
                    padding: "16px 20px",
                    fontSize: 12,
                    color: "var(--ink-tertiary)",
                  }}
                >
                  No tasks due in {selectedQuarter === ALL_TIME ? "any quarter" : selectedQuarter}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modals ── */}
      <ProjectFormModal
        open={showAddProject}
        onClose={() => setShowAddProject(false)}
        onSave={handleRefresh}
        frameworkOptions={portfolio}
      />
      {showManageFrameworks && (
        <ManageFrameworksModal
          open
          onClose={() => setShowManageFrameworks(false)}
          frameworks={portfolio}
          onChange={handleFrameworksChange}
        />
      )}
      {showManagePrograms && (
        <ManageProgramsModal
          open
          onClose={() => setShowManagePrograms(false)}
          frameworks={portfolio}
          programs={programOptions}
          onChange={handleProgramsChange}
        />
      )}
      {showImportExcel && (
        <ImportExcelModal
          open
          onClose={() => setShowImportExcel(false)}
          onSave={handleRefresh}
        />
      )}
      {showHistoryLog && (
        <HistoryLogModal
          open
          onClose={() => setShowHistoryLog(false)}
        />
      )}
    </div>
  );
}
