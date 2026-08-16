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
} from "@/lib/health";
import { STATUS_LABELS, PRIORITY_LABELS, STATUS_SCORES } from "@/lib/status";
import { compareQuarters } from "@/lib/quarters";
import HealthBadge from "@/components/HealthBadge";
import ProjectFormModal from "@/components/ProjectFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import ChangeDueQuarterModal from "@/components/ChangeDueQuarterModal";
import ChangeHistoryModal from "@/components/ChangeHistoryModal";
import ArchiveConfirmModal from "@/components/ArchiveConfirmModal";
import { CachedProject, CachedTask, usePortfolioCache } from "@/components/PortfolioCacheProvider";

type Task = CachedTask;
type Project = CachedProject;

interface Props {
  project: Project;
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
  onMouseEnter,
  onMouseLeave,
}: {
  task: Task;
  onEdit: () => void;
  onChangeQuarter: () => void;
  onViewHistory: () => void;
  onArchive: () => void;
  onInlineSave: (taskId: number, field: "status" | "priority", value: string) => void;
  editingCell: { taskId: number; field: "status" | "priority" } | null;
  setEditingCell: (cell: { taskId: number; field: "status" | "priority" } | null) => void;
  selectRef: React.RefObject<HTMLSelectElement | null>;
  onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  onMouseLeave: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const pct = computeTaskPercentDone(task.status);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="detail-task-row"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <td style={{ width: 32 }}>
        <button
          className="detail-task-action"
          style={{ cursor: "grab", color: "var(--ink-tertiary)", textDecoration: "none" }}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder task"
        >
          <span aria-hidden="true">⠿</span>
        </button>
      </td>
      <td className="detail-task-code" style={{ width: 100 }}>{task.taskCode}</td>
      <td style={{ width: 220 }}>{task.name}</td>
      <td className="detail-muted" style={{ width: 110 }}>{task.assignee || "—"}</td>
      <td
        className="detail-inline-cell detail-muted"
        style={{ width: 80 }}
        onClick={() => setEditingCell({ taskId: task.id, field: "priority" })}
      >
        {editingCell?.taskId === task.id && editingCell.field === "priority" ? (
          <select
            ref={selectRef}
            autoFocus
            defaultValue={task.priority}
            onBlur={(e) => onInlineSave(task.id, "priority", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCell(null);
              if (e.key === "Enter") (e.target as HTMLSelectElement).blur();
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
        style={{ width: 160 }}
        onClick={() => setEditingCell({ taskId: task.id, field: "status" })}
      >
        {editingCell?.taskId === task.id && editingCell.field === "status" ? (
          <select
            ref={selectRef}
            autoFocus
            defaultValue={task.status}
            onBlur={(e) => onInlineSave(task.id, "status", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCell(null);
              if (e.key === "Enter") (e.target as HTMLSelectElement).blur();
            }}
            className="detail-inline-select"
          >
            {STATUS_LABELS.map((s) => (
              <option key={s} value={s}>
                {s}
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
      </td>
    </tr>
  );
}

export default function ProjectDetailView({ project: initialProject }: Props) {
  const router = useRouter();
  const { canReturnToDashboard, setProject } = usePortfolioCache();
  const [project, setCurrentProject] = useState(initialProject);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [changeProjectQuarter, setChangeProjectQuarter] = useState(false);
  const [changeTaskQuarter, setChangeTaskQuarter] = useState<Task | null>(null);
  const [viewHistory, setViewHistory] = useState<{
    type: "Project" | "Task";
    id: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    taskId: number;
    field: "status" | "priority";
  } | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [tasks, setTasks] = useState<Task[]>(initialProject.tasks);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    entityType: "Project" | "Task";
    entityId: number;
    entityName: string;
  } | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [hoveredTask, setHoveredTask] = useState<Task | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCurrentProject(initialProject);
    setTasks(initialProject.tasks);
  }, [initialProject]);

  function handleTaskMouseEnter(task: Task, e: React.MouseEvent<HTMLTableRowElement>) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    hoverTimerRef.current = setTimeout(() => setHoveredTask(task), 250);
  }

  function handleTaskMouseLeave() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredTask(null), 100);
  }

  function updateProject(next: Project) {
    setCurrentProject(next);
    setTasks(next.tasks);
    setProject(next);
  }

  function updateTasks(nextTasks: Task[]) {
    setTasks(nextTasks);
    const nextProject = { ...project, tasks: nextTasks };
    setCurrentProject(nextProject);
    setProject(nextProject);
  }

  const pct = computeProjectPercentComplete(tasks);
  const health =
    tasks.length > 0
      ? computeProjectHealth(pct * 100, project.adjustedTargetQuarter)
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
          : `/api/tasks/${archiveTarget.entityId}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (res.ok) {
        if (archiveTarget.entityType === "Project") {
          router.push("/");
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
      case "status": return STATUS_SCORES[task.status as keyof typeof STATUS_SCORES] ?? 0;
      case "adjustedTargetQuarter": return task.adjustedTargetQuarter;
      case "pct": return Math.round(computeTaskPercentDone(task.status) * 100);
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
    value: string
  ) {
    const previousTasks = tasks;
    setEditingCell(null);
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
    <main className="detail-shell">
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
              onClick={() =>
                setViewHistory({ type: "Project", id: project.id })
              }
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
          </div>
        </section>

        <section className="detail-task-panel" aria-labelledby="tasks-title">
          <div className="detail-task-header">
            <div>
              <h2 id="tasks-title" className="detail-task-heading">Tasks</h2>
              <p className="detail-task-subtitle">
                {tasks.length} task{tasks.length === 1 ? "" : "s"} · Click priority or status to edit inline
              </p>
            </div>
            <button
              onClick={() => setShowAddTask(true)}
              className="detail-button detail-button-primary"
            >
              Add Task
            </button>
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
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="overflow-x-auto">
                  <table className="detail-task-table">
                    <thead>
                      <tr>
                        <th aria-label="Reorder" style={{ width: 32 }} />
                        {[
                          { label: "Code", key: "taskCode", width: 100 },
                          { label: "Name", key: "name", width: 220 },
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
                          onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                          onMouseLeave={handleTaskMouseLeave}
                          />
                      ))}
                    </tbody>
                  </table>
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>

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
          projectId={project.id}
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
              attachments: editTask.attachments || [],
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
