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
  onSave: () => void;
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
      style={style}
      className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2"
    >
      {editId === fw.id ? (
        <div className="flex gap-2 flex-1 items-center">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
          <ColorPicker value={editColor} onChange={setEditColor} />
          <button
            onClick={() => handleRename(fw.id)}
            disabled={loading}
            className="px-3 py-1 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditId(null);
              setEditName("");
              setEditColor("");
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
            <span
              className="w-4 h-4 rounded-full inline-block"
              style={{ backgroundColor: fw.color }}
            />
            <span className="text-sm font-medium">{fw.name}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditId(fw.id);
                setEditName(fw.name);
                setEditColor(fw.color);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(fw.id)}
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

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {PRESET_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          className={`w-6 h-6 rounded-full border-2 ${
            value === c.value ? "border-gray-800" : "border-gray-300"
          }`}
          style={{ backgroundColor: c.value }}
          title={c.label}
        />
      ))}
    </div>
  );
}

export default function ManageFrameworksModal({ open, onClose, onSave }: Props) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
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

  async function loadFrameworks() {
    const res = await fetch("/api/frameworks");
    if (res.ok) {
      const data = await res.json();
      setFrameworks(data);
    }
  }

  useEffect(() => {
    if (open) {
      loadFrameworks();
      setNewName("");
      setNewColor(PRESET_COLORS[0].value);
      setEditId(null);
      setEditName("");
      setEditColor("");
      setError("");
    }
  }, [open]);

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
      setNewName("");
      setNewColor(PRESET_COLORS[0].value);
      loadFrameworks();
      onSave();
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
      setEditId(null);
      setEditName("");
      setEditColor("");
      loadFrameworks();
      onSave();
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
      loadFrameworks();
      onSave();
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

    await fetch("/api/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "framework",
        orderedIds: reordered.map((f) => f.id),
      }),
    });
    onSave();
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Frameworks">
      <div className="space-y-4">
        <div className="space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New framework name"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <button
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={frameworks.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
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
