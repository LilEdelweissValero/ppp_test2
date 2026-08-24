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
import { countTasksByStatus, getStatusScore } from "@/lib/status";
import { compareQuarters, parseQuarter, quarterRange } from "@/lib/quarters";
import { getDefaultSettings } from "@/lib/computation-settings";
import type { ComputationSettings } from "@/lib/computation-settings";
import HealthBadge from "@/components/HealthBadge";
import ProjectFormModal from "@/components/ProjectFormModal";
import ManageFrameworksModal from "@/components/ManageFrameworksModal";
import ManageProgramsModal from "@/components/ManageProgramsModal";
import ImportExcelModal from "@/components/ImportExcelModal";
import ComputationSettingsModal from "@/components/ComputationSettingsModal";
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
  attachments: unknown;
  dependencies: string | null;
  adjustedTargetQuarter: string;
}

interface SpecialTask {
  id: number;
  specialTaskCode: string;
  name: string;
  sortOrder: number;
  total: number;
  nys: number;
  plan: number;
  part: number;
  mostly: number;
  done: number;
  dueQuarter: string;
  lastUpdatedDate: string | null;
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
  specialTasks: SpecialTask[];
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

// Short column labels derived from settings at render time
const STATUS_COL_DEFAULTS = [
  { id: "nys", label: "NYS", color: "#8896A8" },
  { id: "plan", label: "Plan.", color: "#1D4BAA" },
  { id: "part", label: "Part.", color: "#8B5200" },
  { id: "most", label: "Mostly", color: "#0A5FA8" },
  { id: "done", label: "Done", color: "#1A6B3C" },
];

function getStatusCols(settings?: ComputationSettings) {
  const statuses = settings?.statuses ?? getDefaultSettings().statuses;
  return statuses.map((s, i) => ({
    key: s.name,
    label: STATUS_COL_DEFAULTS[i]?.label ?? s.id,
    title: s.name,
    color: STATUS_COL_DEFAULTS[i]?.color ?? "#8896A8",
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function filterTasksByQuarter(tasks: Task[], selectedQuarter: string): Task[] {
  if (selectedQuarter === ALL_TIME) return tasks;
  return tasks.filter((t) => t.adjustedTargetQuarter === selectedQuarter);
}

function expandSpecialTasksToVirtualTasks(specialTasks: SpecialTask[], settings?: ComputationSettings): Task[] {
  const statuses = settings?.statuses ?? getDefaultSettings().statuses;
  const virtuals: Task[] = [];
  for (const st of specialTasks) {
    const counts = [
      { count: st.nys, status: statuses[0].name },
      { count: st.plan, status: statuses[1].name },
      { count: st.part, status: statuses[2].name },
      { count: st.mostly, status: statuses[3].name },
      { count: st.done, status: statuses[4].name },
    ];
    for (const { count, status } of counts) {
      for (let i = 0; i < count; i++) {
        virtuals.push({
          id: -(st.id * 100 + virtuals.length),
          taskCode: st.specialTaskCode,
          name: st.name,
          assignee: null,
          priority: "Low",
          status,
          description: null,
          targetQuarter: st.dueQuarter,
          notes: null,
          deliverable: null,
          attachments: null,
          dependencies: null,
          adjustedTargetQuarter: st.dueQuarter,
        });
      }
    }
  }
  return virtuals;
}

function filterSpecialTasksByQuarter(specialTasks: SpecialTask[], selectedQuarter: string): SpecialTask[] {
  if (selectedQuarter === ALL_TIME) return specialTasks;
  return specialTasks.filter((st) => st.dueQuarter === selectedQuarter);
}

function getAllTasksForProject(project: Project, selectedQuarter: string, settings?: ComputationSettings): Task[] {
  const realTasks = filterTasksByQuarter(project.tasks, selectedQuarter);
  const filteredSpecial = filterSpecialTasksByQuarter(project.specialTasks || [], selectedQuarter);
  const virtualTasks = expandSpecialTasksToVirtualTasks(filteredSpecial, settings);
  return [...realTasks, ...virtualTasks];
}

function getProjectTasksForYear(project: Project, year: number, settings?: ComputationSettings): Task[] {
  const realTasks = project.tasks.filter((t) => {
    const parsed = parseQuarter(t.adjustedTargetQuarter);
    return !!parsed && parsed.year === year;
  });
  const filteredSpecial = (project.specialTasks || []).filter((st) => {
    const parsed = parseQuarter(st.dueQuarter);
    return !!parsed && parsed.year === year;
  });
  const virtualTasks = expandSpecialTasksToVirtualTasks(filteredSpecial, settings);
  return [...realTasks, ...virtualTasks];
}

function getYearsFromQuarters(quarters: string[]): number[] {
  const years = new Set<number>();
  for (const q of quarters) {
    const parsed = parseQuarter(q);
    if (parsed) years.add(parsed.year);
  }
  return Array.from(years).sort((a, b) => b - a);
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
  type: "text" | "numeric" | "quarter" | "status" | "priority" | "health" | "date",
  settings?: ComputationSettings
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
      return getStatusScore(String(a), settings) - getStatusScore(String(b), settings);
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
  selectedQuarter: string,
  settings?: ComputationSettings
): string | number | null {
  const allTasks = getAllTasksForProject(project, selectedQuarter, settings);
  const counts = countTasksByStatus(allTasks, settings);
  const statusNames = settings?.statuses ?? getDefaultSettings().statuses;
  switch (key) {
    case "name": return project.name;
    case "programName": return project.programName ?? "";
    case "reference": return project.reference ?? "";
    case "owner": return project.owner ?? "";
    case "taskCount": return allTasks.length;
    case "count_nys": return counts[statusNames[0].name] ?? 0;
    case "count_plan": return counts[statusNames[1].name] ?? 0;
    case "count_part": return counts[statusNames[2].name] ?? 0;
    case "count_mostly": return counts[statusNames[3].name] ?? 0;
    case "count_done": return counts[statusNames[4].name] ?? 0;
    case "plannedQ": return project.targetQuarter;
    case "dueQ": return project.adjustedTargetQuarter;
    case "completionDate": return project.actualCompletionDate ?? "";
    case "status": return computeProjectDerivedStatus(allTasks, settings);
    case "pct": return Math.round(computeProjectPercentComplete(allTasks, settings) * 100);
    case "health": {
      const pct = computeProjectPercentComplete(allTasks, settings) * 100;
      if (allTasks.length === 0) return "";
      return computeProjectHealth(pct, project.adjustedTargetQuarter, settings) ?? "";
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
  settings,
}: {
  counts: Record<string, number>;
  total: number;
  settings?: ComputationSettings;
}) {
  const statusCols = getStatusCols(settings);
  if (total === 0) {
    return <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>—</span>;
  }
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "center", height: 8 }}>
      {statusCols.map((sc) => {
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
  settings,
}: {
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  settings?: ComputationSettings;
}) {
  const statusCols = getStatusCols(settings);
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
        {statusCols.map((sc, i) => {
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
  settings,
}: {
  program: Program;
  selectedQuarter: string;
  accentColor: string;
  settings?: ComputationSettings;
}) {
  const allTasks = program.projects.flatMap((p) => getAllTasksForProject(p, selectedQuarter, settings));
  const counts = countTasksByStatus(allTasks, settings);
  const total = allTasks.length;
  const statusNames = settings?.statuses ?? getDefaultSettings().statuses;
  const statusCols = getStatusCols(settings);

  // Aggregate program-level metrics from projects (mean of project %'s)
  const projectPcts = program.projects
    .map((p) => {
      const ft = getAllTasksForProject(p, selectedQuarter, settings);
      return ft.length > 0 ? computeProjectPercentComplete(ft, settings) : null;
    })
    .filter((p): p is number => p !== null);
  const programPct = projectPcts.length > 0
    ? projectPcts.reduce((a, b) => a + b, 0) / projectPcts.length
    : 0;
  const programPctRounded = Math.round(programPct * 100);
  const programDerivedStatus = computeProjectDerivedStatus(allTasks, settings);

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
  const doneStatusName = statusNames[4].name;
  const allProjectsComplete = program.projects.length > 0 &&
    program.projects.every((p) => {
      const allP = getAllTasksForProject(p, selectedQuarter, settings);
      return allP.length > 0 && allP.every((t) => t.status === doneStatusName);
    });
  const completionDate = allProjectsComplete
    ? program.projects
        .map((p) => p.actualCompletionDate)
        .filter((d): d is string => d !== null)
        .sort()
        .pop() || null
    : null;

  // Health: computed from program % and latest due quarter
  const programHealth =
    allTasks.length > 0
      ? computeProjectHealth(programPctRounded, dueQ, settings)
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
      {statusCols.map((sc) => (
        <td
          key={sc.key}
          style={{
            padding: "5px 10px",
            textAlign: "center",
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            color: (counts[sc.key] ?? 0) > 0 ? sc.color : "var(--ink-tertiary)",
            fontWeight: (counts[sc.key] ?? 0) > 0 ? 600 : 400,
            background: programBg,
          }}
        >
          {counts[sc.key] ?? 0}
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
  settings,
}: {
  framework: Framework;
  selectedQuarter: string;
  settings?: ComputationSettings;
}) {
  const allTasks = framework.programs.flatMap((prog) =>
    prog.projects.flatMap((p) => getAllTasksForProject(p, selectedQuarter, settings))
  );
  const counts = countTasksByStatus(allTasks, settings);
  const total = allTasks.length;
  const statusCols = getStatusCols(settings);
  const statusNames = settings?.statuses ?? getDefaultSettings().statuses;

  const allProjects = framework.programs.flatMap((prog) => prog.projects);
  const dueQ = allProjects.length > 0
    ? allProjects.reduce((latest, p) =>
        p.adjustedTargetQuarter > latest ? p.adjustedTargetQuarter : latest,
        allProjects[0].adjustedTargetQuarter
      )
    : "—";
  const completionDate = (() => {
    const doneStatusName = statusNames[4].name;
    const completeProgramDates = framework.programs
      .filter((prog) =>
        prog.projects.length > 0 &&
        prog.projects.every((p) => {
          const allP = getAllTasksForProject(p, selectedQuarter, settings);
          return allP.length > 0 && allP.every((t) => t.status === doneStatusName);
        })
      )
      .flatMap((prog) =>
        prog.projects
          .map((p) => p.actualCompletionDate)
          .filter((d): d is string => d !== null)
      )
      .sort();
    return completeProgramDates.length > 0
      ? completeProgramDates[completeProgramDates.length - 1]
      : null;
  })();

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
      {statusCols.map((sc) => (
        <td
          key={sc.key}
          style={{
            padding: "5px 10px",
            textAlign: "center",
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            color: (counts[sc.key] ?? 0) > 0 ? sc.color : "var(--ink-tertiary)",
            fontWeight: (counts[sc.key] ?? 0) > 0 ? 600 : 400,
          }}
        >
          {counts[sc.key] ?? 0}
        </td>
      ))}
      {/* planned Q — blank */}
      <td style={{ padding: "5px 10px", textAlign: "left", width: 88 }} />
      {/* due Q */}
      <td
        style={{
          padding: "5px 10px",
          textAlign: "left",
          width: 88,
          fontSize: 11,
          color: "var(--ink-secondary)",
          fontWeight: 600,
        }}
      >
        {dueQ}
      </td>
      {/* completion date */}
      <td
        style={{
          padding: "5px 10px",
          textAlign: "left",
          width: 90,
          fontSize: 11,
          color: completionDate ? "var(--ink-secondary)" : "var(--rule-strong)",
        }}
      >
        {completionDate || "—"}
      </td>
      <td colSpan={3} />
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
  onProjectUpdate,
  settings,
}: {
  project: Project;
  onPrefetch: () => void;
  onNavigate: () => void;
  selectedQuarter: string;
  isEven: boolean;
  programName: string;
  onProjectUpdate: (fields: Record<string, unknown>) => void;
  settings?: ComputationSettings;
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
  const [editingCell, setEditingCell] = useState<{ field: string } | null>(null);
  const editingRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const filteredTasks = getAllTasksForProject(project, selectedQuarter, settings);

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
        <td
          style={{ ...tdBase, width: 100, fontSize: 11, color: "var(--ink-tertiary)", fontFamily: "var(--font-mono)", cursor: "text" }}
          onClick={() => !editingCell && setEditingCell({ field: "reference" })}
        >
          {editingCell?.field === "reference" ? (
            <input
              ref={editingRef as React.RefObject<HTMLInputElement>}
              autoFocus
              defaultValue={project.reference ?? ""}
              onBlur={(e) => {
                const value = e.target.value.trim();
                setEditingCell(null);
                if (value !== (project.reference ?? "")) {
                  fetch(`/api/projects/${project.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reference: value || null }),
                  }).then(() => onProjectUpdate({ reference: value || null }));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingCell(null);
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              style={{ width: "100%", fontSize: 11, fontFamily: "var(--font-mono)", padding: "1px 4px", border: "1px solid var(--accent)", borderRadius: 2, background: "var(--surface)", color: "var(--ink-primary)", boxSizing: "border-box" }}
            />
          ) : (
            project.reference || "—"
          )}
        </td>
        <td
          style={{ ...tdBase, width: 110, fontSize: 11, color: "var(--ink-secondary)", cursor: "text" }}
          onClick={() => !editingCell && setEditingCell({ field: "owner" })}
        >
          {editingCell?.field === "owner" ? (
            <input
              ref={editingRef as React.RefObject<HTMLInputElement>}
              autoFocus
              defaultValue={project.owner ?? ""}
              onBlur={(e) => {
                const value = e.target.value.trim();
                setEditingCell(null);
                if (value !== (project.owner ?? "")) {
                  fetch(`/api/projects/${project.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ owner: value || null }),
                  }).then(() => onProjectUpdate({ owner: value || null }));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingCell(null);
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              style={{ width: "100%", fontSize: 11, padding: "1px 4px", border: "1px solid var(--accent)", borderRadius: 2, background: "var(--surface)", color: "var(--ink-primary)", boxSizing: "border-box" }}
            />
          ) : (
            project.owner || "—"
          )}
        </td>
        <td colSpan={12} style={{ ...tdBase, fontSize: 11, color: "var(--ink-tertiary)", fontStyle: "italic" }}>
          No tasks due in {selectedQuarter}
        </td>
      </tr>
    );
  }
  const pct = computeProjectPercentComplete(filteredTasks, settings);
  const health =
    filteredTasks.length > 0
      ? computeProjectHealth(pct * 100, project.adjustedTargetQuarter, settings)
      : null;
  const counts = countTasksByStatus(filteredTasks, settings);
  const derivedStatus = computeProjectDerivedStatus(filteredTasks, settings);
  const statusCols = getStatusCols(settings);
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
          cursor: "text",
        }}
        onClick={() => !editingCell && setEditingCell({ field: "reference" })}
      >
        {editingCell?.field === "reference" ? (
          <input
            ref={editingRef as React.RefObject<HTMLInputElement>}
            autoFocus
            defaultValue={project.reference ?? ""}
            onBlur={(e) => {
              const value = e.target.value.trim();
              setEditingCell(null);
              if (value !== (project.reference ?? "")) {
                fetch(`/api/projects/${project.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reference: value || null }),
                }).then(() => onProjectUpdate({ reference: value || null }));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCell(null);
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={{
              width: "100%",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              padding: "1px 4px",
              border: "1px solid var(--accent)",
              borderRadius: 2,
              background: "var(--surface)",
              color: "var(--ink-primary)",
              boxSizing: "border-box",
            }}
          />
        ) : (
          project.reference || "—"
        )}
      </td>

      {/* owner */}
      <td
        style={{
          ...tdBase,
          width: 110,
          color: "var(--ink-secondary)",
          fontSize: 11,
          borderRight: "1px solid var(--rule-strong)",
          cursor: "text",
        }}
        onClick={() => !editingCell && setEditingCell({ field: "owner" })}
      >
        {editingCell?.field === "owner" ? (
          <input
            ref={editingRef as React.RefObject<HTMLInputElement>}
            autoFocus
            defaultValue={project.owner ?? ""}
            onBlur={(e) => {
              const value = e.target.value.trim();
              setEditingCell(null);
              if (value !== (project.owner ?? "")) {
                fetch(`/api/projects/${project.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ owner: value || null }),
                }).then(() => onProjectUpdate({ owner: value || null }));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCell(null);
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={{
              width: "100%",
              fontSize: 11,
              padding: "1px 4px",
              border: "1px solid var(--accent)",
              borderRadius: 2,
              background: "var(--surface)",
              color: "var(--ink-primary)",
              boxSizing: "border-box",
            }}
          />
        ) : (
          project.owner || "—"
        )}
      </td>

      {/* task total */}
      <td style={{ ...tdMetric, width: 56, fontWeight: 600, color: "var(--ink-primary)" }}>
        {filteredTasks.length}
      </td>

      {/* status breakdown */}
      {statusCols.map((sc) => (
        <td
          key={sc.key}
          style={{
            ...tdMetric,
            width: 56,
            color: (counts[sc.key] ?? 0) > 0 ? sc.color : "var(--rule-strong)",
            fontWeight: (counts[sc.key] ?? 0) > 0 ? 600 : 400,
          }}
        >
          {counts[sc.key] ?? 0}
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
          cursor: "pointer",
        }}
        onClick={() => !editingCell && setEditingCell({ field: "dueQ" })}
      >
        {editingCell?.field === "dueQ" ? (
          <select
            ref={editingRef as React.RefObject<HTMLSelectElement>}
            autoFocus
            defaultValue={project.adjustedTargetQuarter}
            onBlur={(e) => {
              const value = e.target.value;
              setEditingCell(null);
              if (value && value !== project.adjustedTargetQuarter) {
                fetch(`/api/projects/${project.id}/change-quarter`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ newQuarter: value }),
                }).then(() => onProjectUpdate({ adjustedTargetQuarter: value }));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCell(null);
              if (e.key === "Enter") (e.target as HTMLSelectElement).blur();
            }}
            style={{
              width: "100%",
              fontSize: 11,
              padding: "1px 2px",
              border: "1px solid var(--accent)",
              borderRadius: 2,
              background: "var(--surface)",
              color: "var(--ink-primary)",
              boxSizing: "border-box",
            }}
          >
            {quarterRange(2, 2).map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        ) : (
          project.adjustedTargetQuarter === project.targetQuarter
            ? "as planned"
            : project.adjustedTargetQuarter
        )}
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
  onSettings,
}: {
  onManageFrameworks: () => void;
  onManagePrograms: () => void;
  onImportExcel: () => void;
  onHistoryLog: () => void;
  onViewArchive: () => void;
  onSettings: () => void;
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
    { label: "Settings", action: onSettings },
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
  const [programsCollapsed, setProgramsCollapsed] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showManageFrameworks, setShowManageFrameworks] = useState(false);
  const [showManagePrograms, setShowManagePrograms] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [compSettings, setCompSettings] = useState<ComputationSettings | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const deferredSearch = useDeferredValue(search);

  // Fetch computation settings
  useEffect(() => {
    fetch("/api/settings/computation")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCompSettings(data);
      })
      .catch(() => {});
  }, []);

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
                p.tasks.some((t) => taskMatches(t, q)) ||
                (p.specialTasks || []).some((st) =>
                  st.specialTaskCode.toLowerCase().includes(q) ||
                  st.name.toLowerCase().includes(q)
                )
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

  function toggleProgramsCollapse() {
    setProgramsCollapsed((prev) => !prev);
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

  // ── Year completion summary ──────────────────────────────────────────────────
  // Derived from existing task quarters (independent of the quarter filter).
  const years = useMemo(() => getYearsFromQuarters(existingQuarters), [existingQuarters]);
  const [selectedYear, setSelectedYear] = useState<number | null>(
    years.length > 0 ? years[0] : null
  );
  const yearPct = useMemo(() => {
    if (selectedYear === null) return null;
    const frameworkPcts: number[] = [];
    for (const fw of frameworks) {
      const programPcts = fw.programs
        .map((prog) => {
          const projPcts = prog.projects
            .map((p) => {
              const yt = getProjectTasksForYear(p, selectedYear, compSettings);
              return yt.length > 0 ? computeProjectPercentComplete(yt, compSettings) : null;
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
      const hasTasks = fw.programs.some((prog) =>
        prog.projects.some((p) => getProjectTasksForYear(p, selectedYear, compSettings).length > 0)
      );
      if (hasTasks) frameworkPcts.push(fwPct);
    }
    if (frameworkPcts.length === 0) return null;
    const mean = frameworkPcts.reduce((sum, pct) => sum + pct, 0) / frameworkPcts.length;
    return Math.round(mean * 100);
  }, [selectedYear, compSettings, frameworks]);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Year completion summary ── */}
      {years.length > 0 && selectedYear !== null && (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--ink-tertiary)",
          }}
        >
          <span>The overall completion rate of ITSD</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            style={{
              fontSize: 12,
              color: "var(--ink-primary)",
              background: "var(--surface)",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              padding: "2px 24px 2px 8px",
              cursor: "pointer",
              appearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238896A8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 6px center",
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span>is</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {yearPct === null ? "—" : `${yearPct}%`}
          </span>
        </div>
      )}

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
            onHistoryLog={() => window.open("/history", "_blank")}
            onViewArchive={() => router.push("/archived")}
            onSettings={() => setShowSettings(true)}
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
            {allCollapsed ? "Expand Frameworks" : "Collapse Frameworks"}
          </button>
          <button
            onClick={toggleProgramsCollapse}
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
            {programsCollapsed ? "Expand Programs" : "Collapse Programs"}
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
            ? allProjects.some((p) => p.tasks.length > 0 || (p.specialTasks || []).length > 0)
            : allProjects.some((p) =>
                p.tasks.some((t) => t.adjustedTargetQuarter === selectedQuarter) ||
                (p.specialTasks || []).some((st) => st.dueQuarter === selectedQuarter)
              );
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
                    const allTasks = allProjects.flatMap((p) => getAllTasksForProject(p, selectedQuarter, compSettings));
                    const counts = countTasksByStatus(allTasks, compSettings);
                    const total = allTasks.length;
                    // Framework % = mean of programs' % (each program % = mean of its projects' %)
                    const programPcts = fw.programs
                      .map((prog) => {
                        const projPcts = prog.projects
                          .map((p) => {
                            const ft = getAllTasksForProject(p, selectedQuarter, compSettings);
                            return ft.length > 0 ? computeProjectPercentComplete(ft, compSettings) : null;
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
                          ), compSettings)
                        : null;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
                          {total} task{total !== 1 ? "s" : ""}
                        </span>
                        <StatusMiniBar counts={counts} total={total} settings={compSettings} />
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
                            settings={compSettings}
                          />
                        </thead>
                        <TableHeader sortConfig={sortConfig} onSort={handleSort} settings={compSettings} />
                        <tbody>

                          {/* Programs + their projects */}
                          {fw.programs.map((prog) => {
                            if (prog.projects.length === 0) return null;
                            const hasTasksInProgram = selectedQuarter === ALL_TIME
                              ? prog.projects.some((p) => p.tasks.length > 0 || (p.specialTasks || []).length > 0)
                              : prog.projects.some((p) =>
                                  p.tasks.some((t) => t.adjustedTargetQuarter === selectedQuarter) ||
                                  (p.specialTasks || []).some((st) => st.dueQuarter === selectedQuarter)
                                );
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
                                  settings={compSettings}
                                />
                                {/* Project rows */}
                                {!programsCollapsed &&
                                sortedProjects.map((project, rowIdx) => (
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
                                    onProjectUpdate={(fields) => {
                                      const cached = getProject(project.id);
                                      if (cached) setProject({ ...cached, ...fields });
                                    }}
                                    settings={compSettings}
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
              {!isCollapsed && !programsCollapsed && !hasProjects && (
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
              {!isCollapsed && !programsCollapsed && hasProjects && !hasTasksInQuarter && (
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
      <ComputationSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
