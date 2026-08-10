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
} from "@/lib/health";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/status";
import HealthBadge from "@/components/HealthBadge";
import ProjectFormModal from "@/components/ProjectFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import ChangeDueQuarterModal from "@/components/ChangeDueQuarterModal";
import ChangeHistoryModal from "@/components/ChangeHistoryModal";

interface Task {
  id: number;
  taskCode: string;
  name: string;
  assignee: string | null;
  priority: string;
  status: string;
  description: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  deliverable: string | null;
  attachmentUrl: string | null;
  dependencies: string | null;
  notes: string | null;
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
  program: { id: number; name: string };
  tasks: Task[];
}

interface Props {
  project: Project;
}

function SortableTaskRow({
  task,
  onEdit,
  onChangeQuarter,
  onViewHistory,
  onInlineSave,
  editingCell,
  setEditingCell,
  selectRef,
  taskCount,
}: {
  task: Task;
  onEdit: () => void;
  onChangeQuarter: () => void;
  onViewHistory: () => void;
  onInlineSave: (taskId: number, field: "status" | "priority", value: string) => void;
  editingCell: { taskId: number; field: "status" | "priority" } | null;
  setEditingCell: (cell: { taskId: number; field: "status" | "priority" } | null) => void;
  selectRef: React.RefObject<HTMLSelectElement | null>;
  taskCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const completedStatuses = ["Complete or Verified"];
  const isCompleted = completedStatuses.includes(task.status);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="detail-task-row"
    >
      <td>
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
      <td className="detail-task-code">{task.taskCode}</td>
      <td>{task.name}</td>
      <td className="detail-muted">{task.assignee || "—"}</td>
      <td
        className="detail-inline-cell detail-muted"
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
      <td className="detail-muted">{task.adjustedTargetQuarter}</td>
      <td style={{ textAlign: "center" }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: isCompleted ? "var(--health-completed-ink)" : "var(--ink-primary)",
        }}>
          {isCompleted ? "✓" : "—"}
        </span>
      </td>
      <td>
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
        </div>
      </td>
    </tr>
  );
}

export default function ProjectDetailView({ project }: Props) {
  const router = useRouter();
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
  const [tasks, setTasks] = useState<Task[]>(project.tasks);

  useEffect(() => {
    setTasks(project.tasks);
  }, [project.tasks]);

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

  function handleRefresh() {
    router.refresh();
  }

  async function handleInlineSave(
    taskId: number,
    field: "status" | "priority",
    value: string
  ) {
    setEditingCell(null);
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    handleRefresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    setTasks(reordered);

    await fetch("/api/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "task",
        orderedIds: reordered.map((t) => t.id),
      }),
    });
    handleRefresh();
  }

  return (
    <main className="detail-shell">
      <div className="detail-container">
        <div>
          <button
            onClick={() => router.push("/")}
            className="detail-back"
          >
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
                items={tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="overflow-x-auto">
                  <table className="detail-task-table">
                    <thead>
                      <tr>
                        <th aria-label="Reorder" />
                        <th>Code</th>
                        <th>Name</th>
                        <th>Assignee</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Quarter Due</th>
                        <th>Done</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <SortableTaskRow
                          key={task.id}
                          task={task}
                          onEdit={() => setEditTask(task)}
                          onChangeQuarter={() => setChangeTaskQuarter(task)}
                          onViewHistory={() =>
                            setViewHistory({ type: "Task", id: task.id })
                          }
                          onInlineSave={handleInlineSave}
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          selectRef={selectRef}
                          taskCount={tasks.length}
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
          onSave={handleRefresh}
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
          onSave={handleRefresh}
          projectId={project.id}
        />

        {editTask && (
          <TaskFormModal
            open={!!editTask}
            onClose={() => setEditTask(null)}
            onSave={handleRefresh}
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
              attachmentUrl: editTask.attachmentUrl || "",
            }}
          />
        )}

        <ChangeDueQuarterModal
          open={changeProjectQuarter}
          onClose={() => setChangeProjectQuarter(false)}
          onSave={handleRefresh}
          entityType="Project"
          entityId={project.id}
          currentQuarter={project.adjustedTargetQuarter}
        />

        {changeTaskQuarter && (
          <ChangeDueQuarterModal
            open={!!changeTaskQuarter}
            onClose={() => setChangeTaskQuarter(null)}
            onSave={handleRefresh}
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
      </div>
    </main>
  );
}
