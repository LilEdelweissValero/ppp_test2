"use client";

import { useEffect, useState } from "react";
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
import Modal from "./Modal";

interface Framework {
  id: number;
  name: string;
}

interface Program {
  id: number;
  name: string;
  frameworkId: number;
  framework: { name: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

function SortableProgram({
  program,
  editId,
  editName,
  setEditId,
  setEditName,
  handleRename,
  handleDelete,
  loading,
}: {
  program: Program;
  editId: number | null;
  editName: string;
  setEditId: (id: number | null) => void;
  setEditName: (name: string) => void;
  handleRename: (id: number) => void;
  handleDelete: (id: number) => void;
  loading: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: program.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2"
    >
      {editId === program.id ? (
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
          <button
            onClick={() => handleRename(program.id)}
            disabled={loading}
            className="px-3 py-1 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditId(null);
              setEditName("");
            }}
            className="px-3 py-1 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1"
              {...attributes}
              {...listeners}
            >
              &#9776;
            </button>
            <span className="text-sm font-medium">{program.name}</span>
            <span className="text-xs text-gray-400">
              {program.framework?.name}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditId(program.id);
                setEditName(program.name);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(program.id)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ManageProgramsModal({ open, onClose, onSave }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [newName, setNewName] = useState("");
  const [newFrameworkId, setNewFrameworkId] = useState<number>(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function loadPrograms() {
    const res = await fetch("/api/programs");
    if (res.ok) {
      const data = await res.json();
      setPrograms(data);
    }
  }

  async function loadFrameworks() {
    const res = await fetch("/api/frameworks");
    if (res.ok) {
      const data = await res.json();
      setFrameworks(data);
    }
  }

  useEffect(() => {
    if (open) {
      loadPrograms();
      loadFrameworks();
      setNewName("");
      setNewFrameworkId(0);
      setEditId(null);
      setEditName("");
      setError("");
    }
  }, [open]);

  async function handleAdd() {
    if (!newName.trim() || !newFrameworkId) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, frameworkId: newFrameworkId }),
    });
    setLoading(false);
    if (res.ok) {
      setNewName("");
      setNewFrameworkId(0);
      loadPrograms();
      onSave();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create program");
    }
  }

  async function handleRename(id: number) {
    if (!editName.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setLoading(false);
    if (res.ok) {
      setEditId(null);
      setEditName("");
      loadPrograms();
      onSave();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to rename program");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this program?")) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      loadPrograms();
      onSave();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to delete program");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = programs.findIndex((p) => p.id === active.id);
    const newIndex = programs.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(programs, oldIndex, newIndex);
    setPrograms(reordered);

    await fetch("/api/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "program",
        orderedIds: reordered.map((p) => p.id),
      }),
    });
    onSave();
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Programs">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={newFrameworkId}
              onChange={(e) => setNewFrameworkId(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Select framework</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New program name"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={loading || !newName.trim() || !newFrameworkId}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={programs.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {programs.map((program) => (
                <SortableProgram
                  key={program.id}
                  program={program}
                  editId={editId}
                  editName={editName}
                  setEditId={setEditId}
                  setEditName={setEditName}
                  handleRename={handleRename}
                  handleDelete={handleDelete}
                  loading={loading}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </Modal>
  );
}
