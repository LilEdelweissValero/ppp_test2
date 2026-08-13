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

const PRESET_COLORS = [
  { value: "#DBEAFE", label: "Blue" },
  { value: "#FEE2E2", label: "Red" },
  { value: "#D1FAE5", label: "Green" },
  { value: "#FEF3C7", label: "Yellow" },
  { value: "#EDE9FE", label: "Purple" },
  { value: "#FCE7F3", label: "Pink" },
  { value: "#CCFBF1", label: "Teal" },
  { value: "#E5E7EB", label: "Gray" },
];

interface Framework {
  id: number;
  name: string;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  frameworks: Framework[];
  onChange: (frameworks: Framework[]) => void;
}

function SortableFramework({
  fw,
  editId,
  editName,
  editColor,
  setEditId,
  setEditName,
  setEditColor,
  handleRename,
  handleDelete,
  loading,
}: {
  fw: Framework;
  editId: number | null;
  editName: string;
  editColor: string;
  setEditId: (id: number | null) => void;
  setEditName: (name: string) => void;
  setEditColor: (color: string) => void;
  handleRename: (id: number) => void;
  handleDelete: (id: number) => void;
  loading: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fw.id });

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
      {editId === fw.id ? (
        <div style={{ display: "flex", gap: 8, flex: 1, alignItems: "center" }}>
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
          <ColorPicker value={editColor} onChange={setEditColor} />
          <button
            onClick={() => handleRename(fw.id)}
            disabled={loading}
            style={{
              padding: "4px 12px",
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
              setEditColor("");
            }}
            style={{
              padding: "4px 12px",
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
              style={{ cursor: "grab", color: "var(--ink-tertiary)", padding: 4 }}
              {...attributes}
              {...listeners}
            >
              &#9776;
            </button>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                display: "inline-block",
                backgroundColor: fw.color,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{fw.name}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setEditId(fw.id);
                setEditName(fw.name);
                setEditColor(fw.color);
              }}
              style={{ fontSize: 12, color: "var(--accent)" }}
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(fw.id)}
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

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: value === c.value ? "2px solid #1F2937" : "2px solid var(--rule-strong)",
            backgroundColor: c.value,
          }}
          title={c.label}
        />
      ))}
    </div>
  );
}

export default function ManageFrameworksModal({
  open,
  onClose,
  frameworks: initialFrameworks,
  onChange,
}: Props) {
  const [frameworks, setFrameworks] = useState<Framework[]>(initialFrameworks);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0].value);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
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
      setFrameworks(initialFrameworks);
      setNewName("");
      setNewColor(PRESET_COLORS[0].value);
      setEditId(null);
      setEditName("");
      setEditColor("");
      setError("");
    }
  }, [open, initialFrameworks]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/frameworks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    setLoading(false);
    if (res.ok) {
      const framework = await res.json();
      const next = [...frameworks, framework];
      setFrameworks(next);
      onChange(next);
      setNewName("");
      setNewColor(PRESET_COLORS[0].value);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create framework");
    }
  }

  async function handleRename(id: number) {
    if (!editName.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/frameworks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    setLoading(false);
    if (res.ok) {
      const framework = await res.json();
      const next = frameworks.map((item) =>
        item.id === id ? framework : item
      );
      setFrameworks(next);
      onChange(next);
      setEditId(null);
      setEditName("");
      setEditColor("");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to rename framework");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this framework?")) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/frameworks/${id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      const next = frameworks.filter((framework) => framework.id !== id);
      setFrameworks(next);
      onChange(next);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to delete framework");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = frameworks.findIndex((f) => f.id === active.id);
    const newIndex = frameworks.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(frameworks, oldIndex, newIndex);
    setFrameworks(reordered);

    try {
      const response = await fetch("/api/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "framework",
          orderedIds: reordered.map((f) => f.id),
        }),
      });
      if (!response.ok) throw new Error("Reorder failed");
      onChange(reordered);
    } catch {
      setFrameworks(initialFrameworks);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Frameworks">
      <div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New framework name"
            style={{
              width: "100%",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              padding: "8px 12px",
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ marginTop: 8 }}>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <button
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              fontSize: 12,
              color: "#FFFFFF",
              background: "var(--accent)",
              borderRadius: 3,
              opacity: loading || !newName.trim() ? 0.5 : 1,
            }}
          >
            Add
          </button>
        </div>

        {error && (
          <p style={{ color: "#B91C1C", fontSize: 12, marginBottom: 16 }}>{error}</p>
        )}

        <DndContext
          id="framework-sort"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={frameworks.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {frameworks.map((fw) => (
                <SortableFramework
                  key={fw.id}
                  fw={fw}
                  editId={editId}
                  editName={editName}
                  editColor={editColor}
                  setEditId={setEditId}
                  setEditName={setEditName}
                  setEditColor={setEditColor}
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
