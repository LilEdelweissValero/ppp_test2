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
  frameworks: Framework[];
  programs: Program[];
  onChange: (programs: Program[]) => void;
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
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid var(--rule)",
        borderRadius: 3,
        padding: "8px 12px",
      }}
    >
      {editId === program.id ? (
        <div style={{ display: "flex", gap: 8, flex: 1 }}>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            style={{
              flex: 1,
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              padding: "4px 8px",
              fontSize: 12,
            }}
          />
          <button
            onClick={() => handleRename(program.id)}
            disabled={loading}
            style={{
              padding: "8px 12px",
              fontSize: 12,
              color: "#FFFFFF",
              background: "#1A6B3C",
              borderRadius: 3,
              opacity: loading ? 0.5 : 1,
            }}
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditId(null);
              setEditName("");
            }}
            style={{
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--ink-primary)",
              background: "var(--ground)",
              borderRadius: 3,
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              style={{
                cursor: "grab",
                color: "var(--ink-tertiary)",
                padding: "0 4px",
              }}
              {...attributes}
              {...listeners}
            >
              &#9776;
            </button>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{program.name}</span>
            <span style={{ fontSize: 10, color: "var(--ink-tertiary)" }}>
              {program.framework?.name}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setEditId(program.id);
                setEditName(program.name);
              }}
              style={{ fontSize: 12, color: "var(--accent)" }}
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(program.id)}
              style={{ fontSize: 12, color: "#B91C1C" }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ManageProgramsModal({
  open,
  onClose,
  frameworks,
  programs: initialPrograms,
  onChange,
}: Props) {
  const [programs, setPrograms] = useState<Program[]>(initialPrograms);
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

  useEffect(() => {
    if (open) {
      setPrograms(initialPrograms);
      setNewName("");
      setNewFrameworkId(0);
      setEditId(null);
      setEditName("");
      setError("");
    }
    // Only reset when modal opens/closes, not on prop changes while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const program = await res.json();
      const framework = frameworks.find((item) => item.id === program.frameworkId);
      const next = [
        ...programs,
        { ...program, framework: { name: framework?.name || "" } },
      ];
      setPrograms(next);
      onChange(next);
      setNewName("");
      setNewFrameworkId(0);
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
      const program = await res.json();
      const next = programs.map((item) =>
        item.id === id ? { ...item, ...program } : item
      );
      setPrograms(next);
      onChange(next);
      setEditId(null);
      setEditName("");
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
      const next = programs.filter((program) => program.id !== id);
      setPrograms(next);
      onChange(next);
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

    try {
      const response = await fetch("/api/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "program",
          orderedIds: reordered.map((p) => p.id),
        }),
      });
      if (!response.ok) throw new Error("Reorder failed");
      onChange(reordered);
    } catch {
      setPrograms(initialPrograms);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Programs" wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={newFrameworkId}
              onChange={(e) => setNewFrameworkId(parseInt(e.target.value))}
              style={{
                border: "1px solid var(--rule-strong)",
                borderRadius: 3,
                padding: "8px 12px",
                fontSize: 12,
              }}
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
              style={{
                flex: 1,
                border: "1px solid var(--rule-strong)",
                borderRadius: 3,
                padding: "8px 12px",
                fontSize: 12,
              }}
            />
            <button
              onClick={handleAdd}
              disabled={loading || !newName.trim() || !newFrameworkId}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                color: "#FFFFFF",
                background: "var(--accent)",
                borderRadius: 3,
                opacity: loading || !newName.trim() || !newFrameworkId ? 0.5 : 1,
              }}
            >
              Add
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: "#B91C1C", fontSize: 12 }}>{error}</p>
        )}

        <DndContext
          id="program-sort"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={programs.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
