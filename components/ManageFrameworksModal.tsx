"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  onChangeLevel: (ids: number[]) => void;
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
  loading,
  selected,
  onToggle,
}: {
  fw: Framework;
  editId: number | null;
  editName: string;
  editColor: string;
  setEditId: (id: number | null) => void;
  setEditName: (name: string) => void;
  setEditColor: (color: string) => void;
  handleRename: (id: number) => void;
  loading: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
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
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(fw.id)}
              style={{ accentColor: "var(--accent)", cursor: "pointer" }}
              aria-label={`Select ${fw.name} for level change`}
            />
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
  onChangeLevel,
}: Props) {
  const [frameworks, setFrameworks] = useState<Framework[]>(initialFrameworks);
  const initialRef = useRef(initialFrameworks);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0].value);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open) {
      setFrameworks(initialFrameworks);
      initialRef.current = initialFrameworks;
      setNewName("");
      setNewColor(PRESET_COLORS[0].value);
      setEditId(null);
      setEditName("");
      setEditColor("");
      setError("");
      setIsDirty(false);
      setSelectedIds(new Set());
    }
  }, [open, initialFrameworks]);

  const handleClose = useCallback(() => {
    if (isDirty && !confirm("You have unsaved changes. Discard?")) return;
    onClose();
  }, [isDirty, onClose]);

  function handleAdd() {
    if (!newName.trim()) return;
    const tempId = Date.now();
    const next = [...frameworks, { id: tempId, name: newName, color: newColor }];
    setFrameworks(next);
    setIsDirty(true);
    setNewName("");
    setNewColor(PRESET_COLORS[0].value);
  }

  function handleRenameLocal(id: number) {
    if (!editName.trim()) return;
    const next = frameworks.map((item) =>
      item.id === id ? { ...item, name: editName, color: editColor } : item
    );
    setFrameworks(next);
    setIsDirty(true);
    setEditId(null);
    setEditName("");
    setEditColor("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = frameworks.findIndex((f) => f.id === active.id);
    const newIndex = frameworks.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(frameworks, oldIndex, newIndex);
    setFrameworks(reordered);
    setIsDirty(true);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = frameworks.length > 0 && frameworks.every((f) => selectedIds.has(f.id));

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(frameworks.map((f) => f.id)));
  }

  async function handleSave() {
    setLoading(true);
    setError("");

    try {
      const initialIds = new Set(initialRef.current.map((f) => f.id));

      const adds = frameworks.filter((f) => !initialIds.has(f.id));
      const renames = frameworks.filter((f) => {
        if (initialIds.has(f.id)) {
          const orig = initialRef.current.find((o) => o.id === f.id);
          return orig && (orig.name !== f.name || orig.color !== f.color);
        }
        return false;
      });
      const reorderedIds = frameworks.map((f) => f.id);
      const initialOrder = initialRef.current.map((f) => f.id);
      const orderChanged =
        reorderedIds.length === initialOrder.length &&
        reorderedIds.some((id, i) => id !== initialOrder[i]);

      const idMap = new Map<number, number>();

      for (const item of adds) {
        const res = await fetch("/api/frameworks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name, color: item.color }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || `Failed to create "${item.name}"`);
          setLoading(false);
          return;
        }
        const created = await res.json();
        idMap.set(item.id, created.id);
      }

      for (const item of renames) {
        const realId = idMap.get(item.id) ?? item.id;
        const res = await fetch(`/api/frameworks/${realId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name, color: item.color }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || `Failed to rename "${item.name}"`);
          setLoading(false);
          return;
        }
      }

      if (orderChanged) {
        const realIds = reorderedIds.map((id) => idMap.get(id) ?? id);
        await fetch("/api/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "framework", orderedIds: realIds }),
        });
      }

      const finalFrameworks = frameworks.map((f) => ({
          id: idMap.get(f.id) ?? f.id,
          name: f.name,
          color: f.color,
        }));

      onChange(finalFrameworks);
      setIsDirty(false);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Manage Frameworks" wide>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New framework name"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              style={{
                flex: 1,
                border: "1px solid var(--rule-strong)",
                borderRadius: 3,
                padding: "8px 12px",
                fontSize: 12,
                outline: "none",
              }}
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <button
              onClick={handleAdd}
              disabled={loading || !newName.trim()}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                color: "#FFFFFF",
                background: "var(--accent)",
                borderRadius: 3,
                opacity: loading || !newName.trim() ? 0.5 : 1,
                cursor: loading || !newName.trim() ? "not-allowed" : "pointer",
              }}
            >
              Add
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !isDirty}
            style={{
              marginLeft: 12,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              color: "#FFFFFF",
              background: isDirty ? "var(--accent)" : "var(--rule)",
              borderRadius: 3,
              opacity: loading || !isDirty ? 0.5 : 1,
              cursor: loading || !isDirty ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>

        {error && (
          <p style={{ color: "#B91C1C", fontSize: 12, marginBottom: 16 }}>{error}</p>
        )}

        {selectedIds.size > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--ground)",
              borderRadius: 3,
              padding: "8px 12px",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => onChangeLevel([...selectedIds])}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                background: "var(--accent)",
                borderRadius: 3,
                cursor: "pointer",
                border: "none",
              }}
            >
              Change Level…
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            fontSize: 11,
            color: "var(--ink-tertiary)",
          }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={frameworks.length === 0}
            style={{ accentColor: "var(--accent)", cursor: "pointer" }}
            aria-label="Select all frameworks"
          />
          <span>Select all</span>
        </div>

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
                  handleRename={handleRenameLocal}
                  loading={loading}
                  selected={selectedIds.has(fw.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </Modal>
  );
}
