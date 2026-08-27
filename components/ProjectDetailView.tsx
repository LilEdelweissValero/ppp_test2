"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  computeTaskPercentDone,
  computePhasePercentComplete,
} from "@/lib/health";
import { PRIORITY_LABELS, getStatusList, getStatusScore } from "@/lib/status";
import { getDefaultSettings } from "@/lib/computation-settings";
import type { ComputationSettings } from "@/lib/computation-settings";
import { compareQuarters } from "@/lib/quarters";
import HealthBadge from "@/components/HealthBadge";
import ProjectFormModal from "@/components/ProjectFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import PhaseFormModal from "@/components/PhaseFormModal";
import PhaseSetupModal from "@/components/PhaseSetupModal";
import ChangeDueQuarterModal from "@/components/ChangeDueQuarterModal";
import ChangeHistoryModal from "@/components/ChangeHistoryModal";
import ArchiveConfirmModal from "@/components/ArchiveConfirmModal";
import { CachedProject, CachedTask, CachedSpecialTask, CachedPhase, usePortfolioCache } from "@/components/PortfolioCacheProvider";

type Task = CachedTask;
type Project = CachedProject;

function expandSpecialTasksToVirtualTasks(specialTasks: CachedSpecialTask[], settings?: ComputationSettings): { status: string; phaseId: number | null }[] {
  const statuses = settings?.statuses ?? getDefaultSettings().statuses;
  const virtuals: { status: string; phaseId: number | null }[] = [];
  for (const st of specialTasks) {
    for (let i = 0; i < st.nys; i++) virtuals.push({ status: statuses[0].name, phaseId: st.phaseId });
    for (let i = 0; i < st.plan; i++) virtuals.push({ status: statuses[1].name, phaseId: st.phaseId });
    for (let i = 0; i < st.part; i++) virtuals.push({ status: statuses[2].name, phaseId: st.phaseId });
    for (let i = 0; i < st.mostly; i++) virtuals.push({ status: statuses[3].name, phaseId: st.phaseId });
    for (let i = 0; i < st.done; i++) virtuals.push({ status: statuses[4].name, phaseId: st.phaseId });
  }
  return virtuals;
}

interface Props {
  project: Project;
  historicalTimestamp?: string | null;
}

function SortableTaskRow({
  task,
  onEdit,
  onChangeQuarter,
  onViewHistory,
  onArchive,
  onInlineSave,
  editingCell,
  setEditingCell,
  selectRef,
  tabTransitioning,
  onMouseEnter,
  onMouseLeave,
  settings,
  isHistorical,
  phases,
  onAssignPhase,
}: {
  task: Task;
  onEdit: () => void;
  onChangeQuarter: () => void;
  onViewHistory: () => void;
  onArchive: () => void;
  onInlineSave: (taskId: number, field: "status" | "priority", value: string, nextCell?: { taskId: number; field: "status" | "priority" }) => void;
  editingCell: { taskId: number; field: "status" | "priority" } | null;
  setEditingCell: (cell: { taskId: number; field: "status" | "priority" } | null) => void;
  selectRef: React.RefObject<HTMLSelectElement | null>;
  tabTransitioning: React.MutableRefObject<boolean>;
  onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  onMouseLeave: () => void;
  settings?: ComputationSettings;
  isHistorical?: boolean;
  phases: CachedPhase[];
  onAssignPhase: (taskId: number, phaseId: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const pct = computeTaskPercentDone(task.status, settings);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="detail-task-row"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <td style={{ width: 32 }}>
        {!isHistorical && (
        <button
          className="detail-task-action"
          style={{ cursor: "grab", color: "var(--ink-tertiary)", textDecoration: "none" }}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder task"
        >
          <span aria-hidden="true">⠿</span>
        </button>
        )}
      </td>
      <td className="detail-task-code" style={{ width: 100 }}>{task.taskCode}</td>
      <td style={{ width: 220 }}>{task.name}</td>
      {phases.length > 0 && (
        <td style={{ width: 100 }}>
          <select
            defaultValue={task.phaseId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onAssignPhase(task.id, val ? parseInt(val) : null);
            }}
            disabled={isHistorical}
            style={{
              fontSize: 11,
              padding: "2px 4px",
              border: "1px solid var(--rule)",
              borderRadius: 3,
              background: "var(--surface)",
              color: "var(--ink-primary)",
              width: "100%",
            }}
          >
            <option value="">—</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </td>
      )}
      <td className="detail-muted" style={{ width: 110 }}>{task.assignee || "—"}</td>
      <td
        className="detail-inline-cell detail-muted"
        style={{ width: 80, cursor: isHistorical ? "default" : undefined }}
        onClick={() => !isHistorical && setEditingCell({ taskId: task.id, field: "priority" })}
      >
        {editingCell?.taskId === task.id && editingCell.field === "priority" ? (
          <select
            ref={selectRef}
            autoFocus
            defaultValue={task.priority}
            onBlur={(e) => {
              if (!tabTransitioning.current) onInlineSave(task.id, "priority", e.target.value);
              else tabTransitioning.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCell(null);
              if (e.key === "Enter") {
                onInlineSave(task.id, "priority", (e.target as HTMLSelectElement).value);
              }
              if (e.key === "Tab") {
                e.preventDefault();
                tabTransitioning.current = true;
                onInlineSave(task.id, "priority", (e.target as HTMLSelectElement).value, { taskId: task.id, field: "status" });
              }
            }}
            className="detail-inline-select"
          >
            {PRIORITY_LABELS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          task.priority
        )}
      </td>
      <td
        className="detail-inline-cell"
        style={{ width: 160, cursor: isHistorical ? "default" : undefined }}
        onClick={() => !isHistorical && setEditingCell({ taskId: task.id, field: "status" })}
      >
        {editingCell?.taskId === task.id && editingCell.field === "status" ? (
          <select
            ref={selectRef}
            autoFocus
            defaultValue={task.status}
            onBlur={(e) => {
              if (!tabTransitioning.current) onInlineSave(task.id, "status", e.target.value);
              else tabTransitioning.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCell(null);
              if (e.key === "Enter") {
                onInlineSave(task.id, "status", (e.target as HTMLSelectElement).value);
              }
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                tabTransitioning.current = true;
                onInlineSave(task.id, "status", (e.target as HTMLSelectElement).value);
              }
              if (e.key === "Tab" && e.shiftKey) {
                e.preventDefault();
                tabTransitioning.current = true;
                onInlineSave(task.id, "status", (e.target as HTMLSelectElement).value, { taskId: task.id, field: "priority" });
              }
            }}
            className="detail-inline-select"
          >
            {getStatusList(settings).map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span>{task.status}</span>
        )}
      </td>
      <td className="detail-muted" style={{ width: 90 }}>{task.adjustedTargetQuarter}</td>
      <td style={{ textAlign: "center", width: 50 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: pct === 1 ? "var(--health-completed-ink)" : "var(--ink-primary)",
        }}>
          {Math.round(pct * 100)}%
        </span>
      </td>
      <td style={{ width: 120 }}>
        {!isHistorical && (
        <div className="detail-task-actions">
          <button
            onClick={onEdit}
            className="detail-task-action"
          >
            Edit
          </button>
          <button
            onClick={onChangeQuarter}
            className="detail-task-action"
          >
            Qtr
          </button>
          <button
            onClick={onViewHistory}
            className="detail-task-action"
          >
            History
          </button>
          <button
            onClick={onArchive}
            className="detail-task-action"
            title="Archive task"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8v13H3V8" />
              <path d="M1 3h22v5H1z" />
              <path d="M10 12h4" />
            </svg>
          </button>
        </div>
        )}
      </td>
    </tr>
  );
}

export default function ProjectDetailView({ project: initialProject, historicalTimestamp }: Props) {
  const router = useRouter();
  const { canReturnToDashboard, setProject } = usePortfolioCache();
  const [project, setCurrentProject] = useState(initialProject);
  const isHistorical = !!historicalTimestamp;
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [changeProjectQuarter, setChangeProjectQuarter] = useState(false);
  const [changeTaskQuarter, setChangeTaskQuarter] = useState<Task | null>(null);
  const [viewHistory, setViewHistory] = useState<{
    type: "Project" | "Task" | "SpecialTask" | "Phase";
    id: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    taskId: number;
    field: "status" | "priority";
  } | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [tasks, setTasks] = useState<Task[]>(initialProject.tasks);
  const [specialTasks, setSpecialTasks] = useState<CachedSpecialTask[]>(initialProject.specialTasks || []);
  const [phases, setPhases] = useState<CachedPhase[]>(initialProject.phases || []);
  const [compSettings, setCompSettings] = useState<ComputationSettings | undefined>(undefined);
  const [showPhaseSetup, setShowPhaseSetup] = useState(false);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [editPhase, setEditPhase] = useState<CachedPhase | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    entityType: "Project" | "Task" | "SpecialTask" | "Phase";
    entityId: number;
    entityName: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/computation")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCompSettings(data);
      })
      .catch(() => {});
  }, []);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [saveOrderError, setSaveOrderError] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [hoveredTask, setHoveredTask] = useState<Task | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabTransitioning = useRef(false);
  const [editSpecialTask, setEditSpecialTask] = useState<CachedSpecialTask | null>(null);
  const [changeSpecialTaskQuarter, setChangeSpecialTaskQuarter] = useState<CachedSpecialTask | null>(null);
  const [editingSpecialCell, setEditingSpecialCell] = useState<{
    taskId: number;
    field: string;
  } | null>(null);
  const specialSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setCurrentProject(initialProject);
    setTasks(initialProject.tasks);
    setSpecialTasks(initialProject.specialTasks || []);
    setPhases(initialProject.phases || []);
  }, [initialProject]);

  // Fetch snapshot data when in historical mode
  useEffect(() => {
    if (!historicalTimestamp) {
      // Restore live settings
      fetch("/api/settings/computation")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setCompSettings(data);
        })
        .catch(() => {});
      return;
    }
    fetch(`/api/snapshot?timestamp=${encodeURIComponent(historicalTimestamp)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.frameworks) return;
        // Find this project in the snapshot
        for (const fw of data.frameworks) {
          for (const prog of fw.programs) {
            for (const pr of prog.projects) {
              if (pr.id === project.id) {
                setCurrentProject({ ...project, ...pr });
                setTasks(pr.tasks as Task[]);
                setSpecialTasks(pr.specialTasks as CachedSpecialTask[]);
                break;
              }
            }
          }
        }
        if (data?.settings) {
          setCompSettings(data.settings);
        }
      })
      .catch(() => {});
  }, [historicalTimestamp, project.id]);

  function handleTaskMouseEnter(task: Task, e: React.MouseEvent<HTMLTableRowElement>) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    hoverTimerRef.current = setTimeout(() => setHoveredTask(task), 250);
  }

  function handleTaskMouseLeave() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredTask(null), 100);
  }

  function updateProject(next: Project) {
    setCurrentProject(next);
    setTasks(next.tasks);
    setSpecialTasks(next.specialTasks || []);
    if (!isHistorical) setProject(next);
  }

  function updateTasks(nextTasks: Task[]) {
    setTasks(nextTasks);
    const nextProject = { ...project, tasks: nextTasks };
    setCurrentProject(nextProject);
    if (!isHistorical) setProject(nextProject);
  }

  function updateSpecialTasks(nextSpecialTasks: CachedSpecialTask[]) {
    setSpecialTasks(nextSpecialTasks);
    const nextProject = { ...project, specialTasks: nextSpecialTasks };
    setCurrentProject(nextProject);
    if (!isHistorical) setProject(nextProject);
  }

  function updatePhases(nextPhases: CachedPhase[]) {
    setPhases(nextPhases);
    const nextProject = { ...project, phases: nextPhases };
    setCurrentProject(nextProject);
    if (!isHistorical) setProject(nextProject);
  }

  const virtualTasks = expandSpecialTasksToVirtualTasks(specialTasks, compSettings);
  const allTasksWithPhase = [...tasks.map((t) => ({ status: t.status, phaseId: t.phaseId })), ...virtualTasks];
  const allTasksForPct = [...tasks, ...virtualTasks];
  const hasPhases = phases.length > 0;
  const pct = computeProjectPercentComplete(
    allTasksForPct,
    compSettings,
    hasPhases ? phases : undefined,
    hasPhases ? allTasksWithPhase : undefined
  );
  const health =
    allTasksForPct.length > 0
      ? computeProjectHealth(pct * 100, project.adjustedTargetQuarter, compSettings)
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleAssignPhase(taskId: number, phaseId: number | null) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId: phaseId ? String(phaseId) : null }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, phaseId } : t))
      );
    } catch {
      // silently fail
    }
  }

  function handleBackToDashboard() {
    if (canReturnToDashboard(project.id)) {
      router.back();
      return;
    }
    router.push("/");
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      const endpoint =
        archiveTarget.entityType === "Project"
          ? `/api/projects/${archiveTarget.entityId}`
          : archiveTarget.entityType === "SpecialTask"
          ? `/api/special-tasks/${archiveTarget.entityId}`
          : archiveTarget.entityType === "Phase"
          ? `/api/phases/${archiveTarget.entityId}`
          : `/api/tasks/${archiveTarget.entityId}`;
      const res = await fetch(endpoint, {
        method: archiveTarget.entityType === "Phase" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: archiveTarget.entityType === "Phase" ? undefined : JSON.stringify({ archived: true }),
      });
      if (res.ok) {
        if (archiveTarget.entityType === "Project") {
          router.push("/");
        } else if (archiveTarget.entityType === "Phase") {
          setPhases(phases.filter((p) => p.id !== archiveTarget.entityId));
          setArchiveTarget(null);
        } else if (archiveTarget.entityType === "SpecialTask") {
          updateSpecialTasks(specialTasks.filter((st) => st.id !== archiveTarget.entityId));
          setArchiveTarget(null);
        } else {
          setTasks(tasks.filter((t) => t.id !== archiveTarget.entityId));
          setArchiveTarget(null);
        }
      }
    } finally {
      setArchiveLoading(false);
    }
  }

  function handleSort(key: string) {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      const numericKeys = new Set(["pct"]);
      return { key, direction: numericKeys.has(key) ? "desc" : "asc" };
    });
  }

  const PRIORITY_ORDINAL: Record<string, number> = { Low: 0, Moderate: 1, High: 2 };

  function getTaskSortValue(task: Task, key: string): string | number {
    switch (key) {
      case "taskCode": return task.taskCode;
      case "name": return task.name;
      case "assignee": return task.assignee ?? "";
      case "priority": return PRIORITY_ORDINAL[task.priority] ?? 0;
      case "status": return getStatusScore(task.status, compSettings);
      case "adjustedTargetQuarter": return task.adjustedTargetQuarter;
      case "pct": return Math.round(computeTaskPercentDone(task.status, compSettings) * 100);
      default: return "";
    }
  }

  const sortedTasks = sortConfig
    ? [...tasks].sort((a, b) => {
        const va = getTaskSortValue(a, sortConfig.key);
        const vb = getTaskSortValue(b, sortConfig.key);
        let cmp: number;
        if (sortConfig.key === "adjustedTargetQuarter") {
          cmp = compareQuarters(String(va), String(vb));
        } else if (typeof va === "number" && typeof vb === "number") {
          cmp = va - vb;
        } else {
          cmp = String(va).localeCompare(String(vb));
        }
        return sortConfig.direction === "asc" ? cmp : -cmp;
      })
    : tasks;

  async function handleInlineSave(
    taskId: number,
    field: "status" | "priority",
    value: string,
    nextCell?: { taskId: number; field: "status" | "priority" }
  ) {
    const previousTasks = tasks;
    setEditingCell(nextCell ?? null);
    updateTasks(tasks.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)));
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error("Update failed");
    } catch {
      updateTasks(previousTasks);
    }
  }

  async function handleSpecialInlineSave(
    taskId: number,
    field: string,
    value: number | string,
    nextCell?: { taskId: number; field: string }
  ) {
    const previousSpecialTasks = specialTasks;
    setEditingSpecialCell(nextCell ?? null);
    updateSpecialTasks(specialTasks.map((st) => (st.id === taskId ? { ...st, [field]: value } : st)));
    try {
      const task = specialTasks.find((st) => st.id === taskId);
      const patch: Record<string, number | string> = { [field]: value };
      if (task && ["nys", "plan", "part", "mostly", "done"].includes(field)) {
        const updated = { ...task, [field]: value };
        patch.total = updated.nys + updated.plan + updated.part + updated.mostly + updated.done;
      }
      const response = await fetch(`/api/special-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Update failed");
      const updated = await response.json();
      updateSpecialTasks(specialTasks.map((st) => (st.id === taskId ? { ...st, ...updated } : st)));
    } catch {
      updateSpecialTasks(previousSpecialTasks);
    }
  }

  async function handleSaveOrder() {
    console.log("[SAVE ORDER] Button clicked — starting handleSaveOrder");
    console.log("[SAVE ORDER] sortConfig:", sortConfig);
    console.log("[SAVE ORDER] sortedTasks:", sortedTasks);
    console.log("[SAVE ORDER] orderedIds being sent:", sortedTasks.map((t) => t.id));

    setSavingOrder(true);
    console.log("[SAVE ORDER] savingOrder set to true");

    setSaveOrderError(null);
    console.log("[SAVE ORDER] saveOrderError reset to null");

    try {
      console.log("[SAVE ORDER] Sending PATCH request to /api/reorder");
      const response = await fetch("/api/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "task",
          orderedIds: sortedTasks.map((t) => t.id),
        }),
      });
      console.log("[SAVE ORDER] Response received. status:", response.status);
      console.log("[SAVE ORDER] Response ok:", response.ok);

      if (!response.ok) {
        const bodyText = await response.text();
        console.error("[SAVE ORDER] Response not ok. body:", bodyText);
        throw new Error(`Save failed (${response.status})`);
      }
      console.log("[SAVE ORDER] Request succeeded — applying reordered tasks locally");
      updateTasks(sortedTasks);
      setSortConfig(null);
      router.refresh();
      console.log("[SAVE ORDER] updateTasks applied, sortConfig cleared, router.refresh() called");
    } catch (err) {
      console.error("[SAVE ORDER] Caught error in handleSaveOrder:", err);
      setSaveOrderError(err instanceof Error ? err.message : "Failed to save order");
      console.log("[SAVE ORDER] saveOrderError set to:", err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setSavingOrder(false);
      console.log("[SAVE ORDER] savingOrder set to false — handleSaveOrder finished");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const previousTasks = tasks;
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    updateTasks(reordered);

    try {
      const response = await fetch("/api/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "task",
          orderedIds: reordered.map((t) => t.id),
        }),
      });
      if (!response.ok) throw new Error("Reorder failed");
    } catch {
      updateTasks(previousTasks);
    }
  }

  return (
    <main className={isHistorical ? "detail-shell readonly-view" : "detail-shell"}>
      <div className="detail-container">
        <div>
          <button type="button" onClick={handleBackToDashboard} className="detail-back">
            <span aria-hidden="true">←</span> Back to Dashboard
          </button>
        </div>

        <section className="detail-hero" aria-labelledby="project-title">
          <div className="detail-title-row">
            <div>
              <p className="detail-kicker">Project detail</p>
              <h1 id="project-title" className="detail-title">
                {project.name}
              </h1>
              <p className="detail-program">{project.program.name}</p>
            </div>
            <HealthBadge health={health} />
          </div>

          <div className="detail-meta-grid">
            <div className="detail-meta-item">
              <span className="detail-meta-label">Reference</span>
              <p className="detail-meta-value">{project.reference || "—"}</p>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">Owner</span>
              <p className="detail-meta-value">{project.owner || "—"}</p>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">Initial quarter due</span>
              <p className="detail-meta-value">
                {project.targetQuarter === project.adjustedTargetQuarter
                  ? "\u2014"
                  : project.targetQuarter}
              </p>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">Quarter due</span>
              <p className="detail-meta-value">{project.adjustedTargetQuarter}</p>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">Actual completion</span>
              <p className="detail-meta-value">{project.actualCompletionDate || "—"}</p>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">Percent complete</span>
              <p className="detail-meta-value">{Math.round(pct * 100)}%</p>
            </div>
          </div>

          <div className="detail-actions">
            {!isHistorical && (
              <>
                <button
                  onClick={() => {
                    if (phases.length === 0 && (tasks.length > 0 || specialTasks.length > 0)) {
                      setShowPhaseSetup(true);
                    } else {
                      setShowAddPhase(true);
                    }
                  }}
                  className="detail-button detail-button-primary"
                >
                  Add Phase
                </button>
                <button
                  onClick={() => setShowEditProject(true)}
                  className="detail-button detail-button-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => setChangeProjectQuarter(true)}
                  className="detail-button"
                >
                  Change Due Quarter
                </button>
                <button
                  onClick={() => setViewHistory({ type: "Project", id: project.id })}
                  className="detail-button"
                >
                  View History
                </button>
                <button
                  onClick={() =>
                    setArchiveTarget({
                      entityType: "Project",
                      entityId: project.id,
                      entityName: project.name,
                    })
                  }
                  className="detail-button"
                  title="Archive project"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle" }}>
                    <path d="M21 8v13H3V8" />
                    <path d="M1 3h22v5H1z" />
                    <path d="M10 12h4" />
                  </svg>
                </button>
              </>
            )}
            {isHistorical && (
              <span style={{ fontSize: 12, color: "var(--ink-tertiary)", fontStyle: "italic" }}>
                Historical view — edits are disabled
              </span>
            )}
          </div>
        </section>

        {/* ── Phases Section ── */}
        {phases.length > 0 && (
        <section className="detail-task-panel" aria-labelledby="phases-title" style={{ borderLeft: "3px solid #6366F1" }}>
          <div className="detail-task-header">
            <div>
              <h2 id="phases-title" className="detail-task-heading">Phases</h2>
              <p className="detail-task-subtitle">
                {phases.length} phase{phases.length === 1 ? "" : "s"}
                {phases.length > 0 && " · Weights must equal 100%"}
              </p>
            </div>
          </div>

          {phases.length === 0 ? (
            <div className="detail-empty">
              <p>No phases defined.</p>
              <p>Phases let you group tasks and weight their contribution to project completion.</p>
            </div>
          ) : (
            <div className="overflow-x-auto detail-task-table-wrap">
              <table className="detail-task-table">
                <thead>
                  <tr>
                    {[
                      { label: "Name", key: "name", width: 200 },
                      { label: "Weight", key: "weight", width: 80 },
                      { label: "# Tasks", key: "taskCount", width: 70 },
                      { label: "% Complete", key: "pct", width: 100 },
                    ].map(({ label, key, width }) => (
                      <th key={key} style={{ width, userSelect: "none" }}>{label}</th>
                    ))}
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {phases.map((phase) => {
                    const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
                    const phaseSpecialTasks = specialTasks.filter((st) => st.phaseId === phase.id);
                    const phaseVirtualTasks = expandSpecialTasksToVirtualTasks(phaseSpecialTasks, compSettings);
                    const allPhaseTasks = [...phaseTasks.map((t) => ({ status: t.status })), ...phaseVirtualTasks];
                    const phasePct = computePhasePercentComplete(allPhaseTasks, compSettings);
                    const phasePctRounded = Math.round(phasePct * 100);

                    return (
                      <tr key={phase.id} className="detail-task-row">
                        <td style={{ width: 200, fontWeight: 500 }}>{phase.name}</td>
                        <td style={{ width: 80, textAlign: "center" }}>{phase.weight}%</td>
                        <td style={{ width: 70, textAlign: "center" }}>{phaseTasks.length + phaseSpecialTasks.length}</td>
                        <td style={{ width: 100, textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                            <div style={{ width: 50, height: 6, background: "var(--rule)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${phasePctRounded}%`, height: "100%", background: phasePctRounded === 100 ? "#1A6B3C" : "#6366F1", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{phasePctRounded}%</span>
                          </div>
                        </td>
                        <td style={{ width: 100 }}>
                          {!isHistorical && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => setEditPhase(phase)}
                                style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setArchiveTarget({ entityType: "Phase", entityId: phase.id, entityName: phase.name })}
                                style={{ fontSize: 11, color: "var(--ink-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}

        <section className="detail-task-panel" aria-labelledby="tasks-title">
          <div className="detail-task-header">
            <div>
              <h2 id="tasks-title" className="detail-task-heading">Tasks</h2>
              <p className="detail-task-subtitle">
                {tasks.length} task{tasks.length === 1 ? "" : "s"}
                {!isHistorical && " · Click priority or status to edit inline"}
              </p>
            </div>
            {!isHistorical && (
              <button
                onClick={() => setShowAddTask(true)}
                className="detail-button detail-button-primary"
              >
                Add Task
              </button>
            )}
          </div>

          {tasks.length === 0 ? (
            <div className="detail-empty">
              <p>No tasks yet.</p>
              <p>Use Add Task to create the first delivery item for this project.</p>
            </div>
          ) : (
            <DndContext
              id="task-sort"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={isHistorical ? () => {} : handleDragEnd}
            >
              <SortableContext
                items={sortedTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="overflow-x-auto detail-task-table-wrap">
                  {sortConfig && (
                    <div className="detail-save-controls">
                      <button
                        type="button"
                        onClick={handleSaveOrder}
                        disabled={savingOrder}
                        className="detail-button detail-save-button"
                      >
                        {savingOrder ? "Saving…" : "SAVE ORDER"}
                      </button>
                      {saveOrderError && (
                        <span className="detail-save-error" role="alert">
                          {saveOrderError}
                        </span>
                      )}
                    </div>
                  )}
                  <table className="detail-task-table">
                    <thead>
                      <tr>
                        <th aria-label="Reorder" style={{ width: 32 }} />
                        {[
                          { label: "Code", key: "taskCode", width: 100 },
                          { label: "Name", key: "name", width: 220 },
                          ...(hasPhases ? [{ label: "Phase", key: "phaseId", width: 100 }] : []),
                          { label: "Assignee", key: "assignee", width: 110 },
                          { label: "Priority", key: "priority", width: 80 },
                          { label: "Status", key: "status", width: 160 },
                          { label: "Quarter Due", key: "adjustedTargetQuarter", width: 90 },
                          { label: "%", key: "pct", width: 50 },
                        ].map(({ label, key, width }) => {
                          const active = sortConfig?.key === key;
                          const arrow = active ? (sortConfig!.direction === "asc" ? " \u25B2" : " \u25BC") : "";
                          return (
                            <th
                              key={key}
                              onClick={() => handleSort(key)}
                              style={{ cursor: "pointer", userSelect: "none", width }}
                            >
                              {label}
                              {arrow && (
                                <span style={{ fontSize: 8, marginLeft: 2, opacity: active ? 1 : 0.4 }}>
                                  {arrow}
                                </span>
                              )}
                            </th>
                          );
                        })}
                        <th style={{ width: 120 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTasks.map((task) => (
                        <SortableTaskRow
                          key={task.id}
                          task={task}
                          onEdit={() => setEditTask(task)}
                          onChangeQuarter={() => setChangeTaskQuarter(task)}
                          onViewHistory={() =>
                            setViewHistory({ type: "Task", id: task.id })
                          }
                          onArchive={() =>
                            setArchiveTarget({
                              entityType: "Task",
                              entityId: task.id,
                              entityName: `${task.taskCode}: ${task.name}`,
                            })
                          }
                          onInlineSave={handleInlineSave}
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          selectRef={selectRef}
                          tabTransitioning={tabTransitioning}
                          onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                          onMouseLeave={handleTaskMouseLeave}
                          settings={compSettings}
                          isHistorical={isHistorical}
                          phases={phases}
                          onAssignPhase={handleAssignPhase}
                          />
                      ))}
                    </tbody>
                  </table>
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>

        {/* ── Special Tasks Section ── */}
        {specialTasks.length > 0 && (
        <section className="detail-task-panel" aria-labelledby="special-tasks-title">
          <div className="detail-task-header">
            <div>
              <h2 id="special-tasks-title" className="detail-task-heading">Special Tasks</h2>
              <p className="detail-task-subtitle">
                {specialTasks.length} special task{specialTasks.length === 1 ? "" : "s"}
                {!isHistorical && " · Click cells to edit inline"}
              </p>
            </div>
          </div>

            <div className="overflow-x-auto">
              <table className="detail-task-table">
                <thead>
                  <tr>
                    {[
                      { label: "Code", key: "specialTaskCode", width: 100 },
                      { label: "Name", key: "name", width: 180 },
                      ...(hasPhases ? [{ label: "Phase", key: "phaseId", width: 100 }] : []),
                      { label: "#", key: "total", width: 50 },
                      { label: "NYS", key: "nys", width: 50 },
                      { label: "PLAN.", key: "plan", width: 55 },
                      { label: "PART.", key: "part", width: 55 },
                      { label: "MOSTLY", key: "mostly", width: 65 },
                      { label: "DONE", key: "done", width: 55 },
                      { label: "DUE Q", key: "dueQuarter", width: 80 },
                      { label: "LAST UPDATED", key: "lastUpdatedDate", width: 100 },
                      { label: "%", key: "pct", width: 50 },
                    ].map(({ label, key, width }) => (
                      <th key={key} style={{ width, userSelect: "none" }}>
                        {label}
                      </th>
                    ))}
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {specialTasks.map((st) => {
                    const total = st.nys + st.plan + st.part + st.mostly + st.done;
                    const pctVal = total > 0 ? Math.round((st.done / total) * 100) : 0;
                    return (
                      <tr key={st.id} className="detail-task-row">
                        <td className="detail-task-code" style={{ width: 100 }}>{st.specialTaskCode}</td>
                        <td style={{ width: 180 }}>{st.name}</td>
                        {hasPhases && (
                          <td style={{ width: 100 }}>
                            <select
                              defaultValue={st.phaseId ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const phaseId = val ? parseInt(val) : null;
                                fetch(`/api/special-tasks/${st.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ phaseId: phaseId ? String(phaseId) : null }),
                                }).then(() => {
                                  setSpecialTasks((prev) =>
                                    prev.map((s) => (s.id === st.id ? { ...s, phaseId } : s))
                                  );
                                });
                              }}
                              disabled={isHistorical}
                              style={{
                                fontSize: 11,
                                padding: "2px 4px",
                                border: "1px solid var(--rule)",
                                borderRadius: 3,
                                background: "var(--surface)",
                                color: "var(--ink-primary)",
                                width: "100%",
                              }}
                            >
                              <option value="">—</option>
                              {phases.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        {/* # */}
                        <td style={{ width: 50, textAlign: "center", fontSize: 11 }}>
                          {total}
                        </td>
                        {/* NYS */}
                        <td
                          className="detail-inline-cell"
                          style={{ width: 50, textAlign: "center", cursor: isHistorical ? "default" : undefined }}
                          onClick={() => !isHistorical && setEditingSpecialCell({ taskId: st.id, field: "nys" })}
                        >
                          {editingSpecialCell?.taskId === st.id && editingSpecialCell.field === "nys" ? (
                            <input
                              type="number"
                              defaultValue={st.nys}
                              autoFocus
                              className="detail-inline-input"
                              onBlur={(e) => {
                                if (!tabTransitioning.current) handleSpecialInlineSave(st.id, "nys", parseInt(e.target.value) || 0);
                                else tabTransitioning.current = false;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingSpecialCell(null);
                                if (e.key === "Enter") handleSpecialInlineSave(st.id, "nys", parseInt((e.target as HTMLInputElement).value) || 0);
                                if (e.key === "Tab" && !e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "nys", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "plan" });
                                }
                                if (e.key === "Tab" && e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "nys", parseInt((e.target as HTMLInputElement).value) || 0);
                                }
                              }}
                              style={{ width: 45, fontSize: 11, textAlign: "center" }}
                            />
                          ) : (
                            st.nys
                          )}
                        </td>
                        {/* PLAN */}
                        <td
                          className="detail-inline-cell"
                          style={{ width: 55, textAlign: "center", cursor: isHistorical ? "default" : undefined }}
                          onClick={() => !isHistorical && setEditingSpecialCell({ taskId: st.id, field: "plan" })}
                        >
                          {editingSpecialCell?.taskId === st.id && editingSpecialCell.field === "plan" ? (
                            <input
                              type="number"
                              defaultValue={st.plan}
                              autoFocus
                              className="detail-inline-input"
                              onBlur={(e) => {
                                if (!tabTransitioning.current) handleSpecialInlineSave(st.id, "plan", parseInt(e.target.value) || 0);
                                else tabTransitioning.current = false;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingSpecialCell(null);
                                if (e.key === "Enter") handleSpecialInlineSave(st.id, "plan", parseInt((e.target as HTMLInputElement).value) || 0);
                                if (e.key === "Tab" && !e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "plan", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "part" });
                                }
                                if (e.key === "Tab" && e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "plan", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "nys" });
                                }
                              }}
                              style={{ width: 45, fontSize: 11, textAlign: "center" }}
                            />
                          ) : (
                            st.plan
                          )}
                        </td>
                        {/* PART */}
                        <td
                          className="detail-inline-cell"
                          style={{ width: 55, textAlign: "center", cursor: isHistorical ? "default" : undefined }}
                          onClick={() => !isHistorical && setEditingSpecialCell({ taskId: st.id, field: "part" })}
                        >
                          {editingSpecialCell?.taskId === st.id && editingSpecialCell.field === "part" ? (
                            <input
                              type="number"
                              defaultValue={st.part}
                              autoFocus
                              className="detail-inline-input"
                              onBlur={(e) => {
                                if (!tabTransitioning.current) handleSpecialInlineSave(st.id, "part", parseInt(e.target.value) || 0);
                                else tabTransitioning.current = false;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingSpecialCell(null);
                                if (e.key === "Enter") handleSpecialInlineSave(st.id, "part", parseInt((e.target as HTMLInputElement).value) || 0);
                                if (e.key === "Tab" && !e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "part", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "mostly" });
                                }
                                if (e.key === "Tab" && e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "part", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "plan" });
                                }
                              }}
                              style={{ width: 45, fontSize: 11, textAlign: "center" }}
                            />
                          ) : (
                            st.part
                          )}
                        </td>
                        {/* MOSTLY */}
                        <td
                          className="detail-inline-cell"
                          style={{ width: 65, textAlign: "center", cursor: isHistorical ? "default" : undefined }}
                          onClick={() => !isHistorical && setEditingSpecialCell({ taskId: st.id, field: "mostly" })}
                        >
                          {editingSpecialCell?.taskId === st.id && editingSpecialCell.field === "mostly" ? (
                            <input
                              type="number"
                              defaultValue={st.mostly}
                              autoFocus
                              className="detail-inline-input"
                              onBlur={(e) => {
                                if (!tabTransitioning.current) handleSpecialInlineSave(st.id, "mostly", parseInt(e.target.value) || 0);
                                else tabTransitioning.current = false;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingSpecialCell(null);
                                if (e.key === "Enter") handleSpecialInlineSave(st.id, "mostly", parseInt((e.target as HTMLInputElement).value) || 0);
                                if (e.key === "Tab" && !e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "mostly", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "done" });
                                }
                                if (e.key === "Tab" && e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "mostly", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "part" });
                                }
                              }}
                              style={{ width: 50, fontSize: 11, textAlign: "center" }}
                            />
                          ) : (
                            st.mostly
                          )}
                        </td>
                        {/* DONE */}
                        <td
                          className="detail-inline-cell"
                          style={{ width: 55, textAlign: "center", cursor: isHistorical ? "default" : undefined }}
                          onClick={() => !isHistorical && setEditingSpecialCell({ taskId: st.id, field: "done" })}
                        >
                          {editingSpecialCell?.taskId === st.id && editingSpecialCell.field === "done" ? (
                            <input
                              type="number"
                              defaultValue={st.done}
                              autoFocus
                              className="detail-inline-input"
                              onBlur={(e) => {
                                if (!tabTransitioning.current) handleSpecialInlineSave(st.id, "done", parseInt(e.target.value) || 0);
                                else tabTransitioning.current = false;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingSpecialCell(null);
                                if (e.key === "Enter") handleSpecialInlineSave(st.id, "done", parseInt((e.target as HTMLInputElement).value) || 0);
                                if (e.key === "Tab" && !e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "done", parseInt((e.target as HTMLInputElement).value) || 0);
                                }
                                if (e.key === "Tab" && e.shiftKey) {
                                  e.preventDefault();
                                  tabTransitioning.current = true;
                                  handleSpecialInlineSave(st.id, "done", parseInt((e.target as HTMLInputElement).value) || 0, { taskId: st.id, field: "mostly" });
                                }
                              }}
                              style={{ width: 45, fontSize: 11, textAlign: "center" }}
                            />
                          ) : (
                            st.done
                          )}
                        </td>
                        <td className="detail-muted" style={{ width: 80 }}>{st.dueQuarter}</td>
                        <td className="detail-muted" style={{ width: 100, fontSize: 11 }}>
                          {st.lastUpdatedDate || "—"}
                        </td>
                        <td style={{ textAlign: "center", width: 50 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: pctVal === 100 ? "var(--health-completed-ink)" : "var(--ink-primary)",
                          }}>
                            {pctVal}%
                          </span>
                        </td>
                        <td style={{ width: 120 }}>
                          {!isHistorical && (
                          <div className="detail-task-actions">
                            <button
                              onClick={() => setEditSpecialTask(st)}
                              className="detail-task-action"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setChangeSpecialTaskQuarter(st)}
                              className="detail-task-action"
                            >
                              Qtr
                            </button>
                            <button
                              onClick={() =>
                                setViewHistory({ type: "SpecialTask", id: st.id })
                              }
                              className="detail-task-action"
                            >
                              History
                            </button>
                            <button
                              onClick={() =>
                                setArchiveTarget({
                                  entityType: "SpecialTask",
                                  entityId: st.id,
                                  entityName: `${st.specialTaskCode}: ${st.name}`,
                                })
                              }
                              title="Archive special task"
                              className="detail-task-action"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 8v13H3V8" />
                                <path d="M1 3h22v5H1z" />
                                <path d="M10 12h4" />
                              </svg>
                            </button>
                          </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </section>
        )}

        {!isHistorical && (
        <>
        <ProjectFormModal
          open={showEditProject}
          onClose={() => setShowEditProject(false)}
          onSave={(savedProject) => {
            updateProject({
              ...project,
              ...savedProject,
              program: savedProject.program || project.program,
              tasks,
            });
          }}
          initialData={{
            id: project.id,
            name: project.name,
            programId: project.programId,
            reference: project.reference || "",
            owner: project.owner || "",
            targetQuarter: project.targetQuarter,
            actualCompletionDate: project.actualCompletionDate || "",
          }}
        />

        <TaskFormModal
          open={showAddTask}
          onClose={() => setShowAddTask(false)}
          onSave={(newTask) => {
            updateTasks([...tasks, newTask]);
          }}
          onSaveSpecial={(newSpecialTask) => {
            updateSpecialTasks([...specialTasks, newSpecialTask]);
          }}
          projectId={project.id}
          phases={phases}
        />

        {editTask && (
          <TaskFormModal
            open={!!editTask}
            onClose={() => setEditTask(null)}
            onSave={(savedTask) => {
              updateTasks(tasks.map((task) =>
                task.id === savedTask.id ? savedTask : task
              ));
              setEditTask(null);
            }}
            projectId={project.id}
            phases={phases}
            initialData={{
              id: editTask.id,
              taskCode: editTask.taskCode,
              name: editTask.name,
              assignee: editTask.assignee || "",
              priority: editTask.priority,
              description: editTask.description || "",
              dependencies: editTask.dependencies || "",
              notes: editTask.notes || "",
              status: editTask.status,
              targetQuarter: editTask.targetQuarter,
              deliverable: editTask.deliverable || "",
              attachments: Array.isArray(editTask.attachments) ? editTask.attachments as { url: string; title: string | null }[] : [],
              phaseId: editTask.phaseId,
            }}
          />
        )}

        <ChangeDueQuarterModal
          open={changeProjectQuarter}
          onClose={() => setChangeProjectQuarter(false)}
          onSave={({ newQuarter }) => {
            updateProject({ ...project, adjustedTargetQuarter: newQuarter, tasks });
          }}
          entityType="Project"
          entityId={project.id}
          currentQuarter={project.adjustedTargetQuarter}
        />

        {changeTaskQuarter && (
          <ChangeDueQuarterModal
            open={!!changeTaskQuarter}
            onClose={() => setChangeTaskQuarter(null)}
            onSave={({ newQuarter }) => {
              updateTasks(tasks.map((task) =>
                task.id === changeTaskQuarter.id
                  ? { ...task, adjustedTargetQuarter: newQuarter }
                  : task
              ));
              setChangeTaskQuarter(null);
            }}
            entityType="Task"
            entityId={changeTaskQuarter.id}
            currentQuarter={changeTaskQuarter.adjustedTargetQuarter}
          />
        )}

        {editSpecialTask && (
          <TaskFormModal
            open={!!editSpecialTask}
            onClose={() => setEditSpecialTask(null)}
            onSave={() => {}}
            onSaveSpecial={(savedSpecialTask) => {
              updateSpecialTasks(specialTasks.map((st) =>
                st.id === savedSpecialTask.id ? savedSpecialTask : st
              ));
              setEditSpecialTask(null);
            }}
            projectId={project.id}
            phases={phases}
            initialSpecialData={{
              id: editSpecialTask.id,
              specialTaskCode: editSpecialTask.specialTaskCode,
              name: editSpecialTask.name,
              dueQuarter: editSpecialTask.dueQuarter,
              lastUpdatedDate: editSpecialTask.lastUpdatedDate,
              phaseId: editSpecialTask.phaseId,
            }}
          />
        )}

        {changeSpecialTaskQuarter && (
          <ChangeDueQuarterModal
            open={!!changeSpecialTaskQuarter}
            onClose={() => setChangeSpecialTaskQuarter(null)}
            onSave={({ newQuarter }) => {
              updateSpecialTasks(specialTasks.map((st) =>
                st.id === changeSpecialTaskQuarter.id
                  ? { ...st, dueQuarter: newQuarter }
                  : st
              ));
              setChangeSpecialTaskQuarter(null);
            }}
            entityType="SpecialTask"
            entityId={changeSpecialTaskQuarter.id}
            currentQuarter={changeSpecialTaskQuarter.dueQuarter}
          />
        )}
        </>
        )}

        {showPhaseSetup && (
          <PhaseSetupModal
            open={showPhaseSetup}
            onClose={() => setShowPhaseSetup(false)}
            projectId={project.id}
            tasks={tasks}
            specialTasks={specialTasks}
            onSaved={(createdPhases, updatedTasks, updatedSpecialTasks) => {
              setPhases(createdPhases);
              setTasks(updatedTasks);
              setSpecialTasks(updatedSpecialTasks);
            }}
          />
        )}

        {showAddPhase && (
          <PhaseFormModal
            open={showAddPhase}
            onClose={() => setShowAddPhase(false)}
            projectId={project.id}
            onSaved={(phase) => {
              setPhases([...phases, phase]);
            }}
          />
        )}

        {editPhase && (
          <PhaseFormModal
            open={!!editPhase}
            onClose={() => setEditPhase(null)}
            projectId={project.id}
            initialData={editPhase}
            onSaved={(updatedPhase) => {
              setPhases(phases.map((p) => p.id === updatedPhase.id ? updatedPhase : p));
              setEditPhase(null);
            }}
          />
        )}

        {viewHistory && (
          <ChangeHistoryModal
            open={!!viewHistory}
            onClose={() => setViewHistory(null)}
            entityType={viewHistory.type}
            entityId={viewHistory.id}
          />
        )}

        {archiveTarget && (
          <ArchiveConfirmModal
            open={!!archiveTarget}
            onClose={() => setArchiveTarget(null)}
            onConfirm={handleArchiveConfirm}
            entityType={archiveTarget.entityType}
            entityName={archiveTarget.entityName}
            entityId={archiveTarget.entityId}
            loading={archiveLoading}
          />
        )}

        {hoveredTask && (hoveredTask.description || (Array.isArray(hoveredTask.attachments) && hoveredTask.attachments.length > 0)) && (
          <div
            className="task-tooltip"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
            onMouseEnter={() => {
              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            }}
            onMouseLeave={handleTaskMouseLeave}
          >
            {hoveredTask.description && (
              <div className="task-tooltip-section">
                <span className="task-tooltip-label">Description</span>
                <p className="task-tooltip-text">{hoveredTask.description}</p>
              </div>
            )}
            {Array.isArray(hoveredTask.attachments) && hoveredTask.attachments.length > 0 && (
              <div className="task-tooltip-section">
                <span className="task-tooltip-label">Attachments</span>
                <ul className="task-tooltip-links">
                  {hoveredTask.attachments.map((att, i) => (
                    <li key={i}>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="task-tooltip-link"
                      >
                        {att.title || att.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
