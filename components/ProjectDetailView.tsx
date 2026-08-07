"use client";

import { useState, useRef } from "react";
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
}: {
  task: Task;
  onEdit: () => void;
  onChangeQuarter: () => void;
  onViewHistory: () => void;
  onInlineSave: (taskId: number, field: "status" | "priority", value: string) => void;
  editingCell: { taskId: number; field: "status" | "priority" } | null;
  setEditingCell: (cell: { taskId: number; field: "status" | "priority" } | null) => void;
  selectRef: React.RefObject<HTMLSelectElement | null>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 hover:bg-gray-50"
    >
      <td className="px-4 py-2">
        <button
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          {...attributes}
          {...listeners}
        >
          &#9776;
        </button>
      </td>
      <td className="px-4 py-2 font-mono text-xs">{task.taskCode}</td>
      <td className="px-4 py-2">{task.name}</td>
      <td className="px-4 py-2 text-gray-600">{task.assignee || "-"}</td>
      <td
        className="px-4 py-2 text-gray-600 cursor-pointer hover:bg-blue-50"
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
            className="w-full border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        className="px-4 py-2 cursor-pointer hover:bg-blue-50"
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
            className="w-full border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_LABELS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-gray-700">{task.status}</span>
        )}
      </td>
      <td className="px-4 py-2 text-gray-600">{task.targetQuarter}</td>
      <td className="px-4 py-2 text-gray-600">{task.adjustedTargetQuarter}</td>
      <td className="px-4 py-2 text-gray-600">{task.deliverable || "-"}</td>
      <td className="px-4 py-2">
        {task.attachmentUrl ? (
          <a
            href={task.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-xs"
          >
            Link
          </a>
        ) : (
          "-"
        )}
      </td>
      <td className="px-4 py-2 text-gray-600 max-w-[150px] truncate">
        {task.dependencies || "-"}
      </td>
      <td className="px-4 py-2 text-gray-600 max-w-[150px] truncate">
        {task.notes || "-"}
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
          <button
            onClick={onChangeQuarter}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Qtr
          </button>
          <button
            onClick={onViewHistory}
            className="text-xs text-blue-600 hover:text-blue-800"
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to Dashboard
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {project.name}
              </h1>
              <p className="text-sm text-gray-500">
                {project.program.name}
              </p>
            </div>
            <HealthBadge health={health} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-500">Reference</span>
              <p className="font-medium">{project.reference || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">Owner</span>
              <p className="font-medium">{project.owner || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">Initial Quarter Due</span>
              <p className="font-medium">
                {project.targetQuarter === project.adjustedTargetQuarter
                  ? "\u2014"
                  : project.targetQuarter}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Quarter Due</span>
              <p className="font-medium">
                {project.adjustedTargetQuarter}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Actual Completion Date</span>
              <p className="font-medium">
                {project.actualCompletionDate || "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Percent Complete</span>
              <p className="font-medium">{Math.round(pct * 100)}%</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowEditProject(true)}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Edit
            </button>
            <button
              onClick={() => setChangeProjectQuarter(true)}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Change Due Quarter
            </button>
            <button
              onClick={() =>
                setViewHistory({ type: "Project", id: project.id })
              }
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              View History
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Tasks</h2>
            <button
              onClick={() => setShowAddTask(true)}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Add Task
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="px-4 py-6 text-gray-500 text-sm text-center">
              No tasks yet. Click &quot;Add Task&quot; to create one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-4 py-2 font-medium w-[40px]"></th>
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Assignee</th>
                    <th className="px-4 py-2 font-medium">Priority</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Initial Qtr</th>
                    <th className="px-4 py-2 font-medium">Quarter Due</th>
                    <th className="px-4 py-2 font-medium">Deliverable</th>
                    <th className="px-4 py-2 font-medium">Link</th>
                    <th className="px-4 py-2 font-medium">Dependencies</th>
                    <th className="px-4 py-2 font-medium">Notes</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={tasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
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
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </tbody>
              </table>
            </div>
          )}
        </div>

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
