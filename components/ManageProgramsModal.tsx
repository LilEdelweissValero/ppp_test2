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
import AbandonConfirmModal from "./AbandonConfirmModal";

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
  onChangeLevel: (ids: number[]) => void;
}

function SortableProgram({
  program,
  editId,
  editName,
  setEditId,
  setEditName,
  handleRename,
  handleAbandon,
  loading,
  selected,
  onToggle,
}: {
  program: Program;
  editId: number | null;
  editName: string;
  setEditId: (id: number | null) => void;
  setEditName: (name: string) => void;
  handleRename: (id: number) => void;
  handleAbandon: (id: number, name: string) => void;
  loading: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
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
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(program.id)}
              style={{ accentColor: "var(--accent)", cursor: "pointer" }}
              aria-label={`Select ${program.name} for level change`}
            />
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
              onClick={() => handleAbandon(program.id, program.name)}
              title="Abandon program"
              style={{ color: "#B91C1C", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontSize: 12, fontWeight: 500 }}
            >
              Abandon
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
  onChangeLevel,
}: Props) {
  const [programs, setPrograms] = useState<Program[]>(initialPrograms);
  const initialRef = useRef(initialPrograms);
  const [newName, setNewName] = useState("");
  const [newFrameworkId, setNewFrameworkId] = useState<number>(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [abandonTarget, setAbandonTarget] = useState<{
    entityId: number;
    entityName: string;
  } | null>(null);
  const [abandonReasons, setAbandonReasons] = useState<string[]>([]);
  const [abandonLoading, setAbandonLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open) {
      setPrograms(initialPrograms);
      initialRef.current = initialPrograms;
      setNewName("");
      setNewFrameworkId(0);
      setEditId(null);
      setEditName("");
      setError("");
      setIsDirty(false);
      setSelectedIds(new Set());
      // Fetch abandonment reasons
      fetch("/api/settings/computation")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.abandonmentReasons) setAbandonReasons(data.abandonmentReasons);
        })
        .catch(() => {});
    }
    // Only reset when modal opens/closes, not on prop changes while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = useCallback(() => {
    if (isDirty && !confirm("You have unsaved changes. Discard?")) return;
    onClose();
  }, [isDirty, onClose]);

  function handleAdd() {
    if (!newName.trim() || !newFrameworkId) return;
    const tempId = Date.now();
    const framework = frameworks.find((item) => item.id === newFrameworkId);
    const next = [
      ...programs,
      { id: tempId, name: newName, frameworkId: newFrameworkId, framework: { name: framework?.name || "" } },
    ];
    setPrograms(next);
    setIsDirty(true);
    setNewName("");
    setNewFrameworkId(0);
  }

  function handleRenameLocal(id: number) {
    if (!editName.trim()) return;
    const next = programs.map((item) =>
      item.id === id ? { ...item, name: editName } : item
    );
    setPrograms(next);
    setIsDirty(true);
    setEditId(null);
    setEditName("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = programs.findIndex((p) => p.id === active.id);
    const newIndex = programs.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(programs, oldIndex, newIndex);
    setPrograms(reordered);
    setIsDirty(true);
  }

  function handleAbandonClick(id: number, name: string) {
    setAbandonTarget({ entityId: id, entityName: name });
  }

  async function handleAbandonConfirm(reason: string, remarks: string) {
    if (!abandonTarget) return;
    setAbandonLoading(true);
    try {
      const res = await fetch(`/api/programs/${abandonTarget.entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abandoned: true,
          abandonedReason: reason,
          abandonedRemarks: remarks || null,
        }),
      });
      if (res.ok) {
        setPrograms(programs.filter((p) => p.id !== abandonTarget.entityId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(abandonTarget.entityId);
          return next;
        });
        setIsDirty(true);
        setAbandonTarget(null);
      }
    } finally {
      setAbandonLoading(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = programs.length > 0 && programs.every((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(programs.map((p) => p.id)));
  }

  async function handleSave() {
    setLoading(true);
    setError("");

    try {
      const initialIds = new Set(initialRef.current.map((p) => p.id));

      const adds = programs.filter((p) => !initialIds.has(p.id));
      const renames = programs.filter((p) => {
        if (initialIds.has(p.id)) {
          const orig = initialRef.current.find((o) => o.id === p.id);
          return orig && orig.name !== p.name;
        }
        return false;
      });
      const reorderedIds = programs.map((p) => p.id);
      const initialOrder = initialRef.current.map((p) => p.id);
      const orderChanged =
        reorderedIds.length === initialOrder.length &&
        reorderedIds.some((id, i) => id !== initialOrder[i]);

      const idMap = new Map<number, number>();

      for (const item of adds) {
        const res = await fetch("/api/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name, frameworkId: item.frameworkId }),
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
        const res = await fetch(`/api/programs/${realId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name }),
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
          body: JSON.stringify({ entityType: "program", orderedIds: realIds }),
        });
      }

      const finalPrograms = programs.map((p) => ({
        id: idMap.get(p.id) ?? p.id,
        name: p.name,
        frameworkId: p.frameworkId,
        framework: p.framework,
      }));

      onChange(finalPrograms);
      setIsDirty(false);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Manage Programs" wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
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
              cursor: loading || !newName.trim() || !newFrameworkId ? "not-allowed" : "pointer",
            }}
          >
            Add
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !isDirty}
            style={{
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
          <p style={{ color: "#B91C1C", fontSize: 12 }}>{error}</p>
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
            fontSize: 11,
            color: "var(--ink-tertiary)",
          }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={programs.length === 0}
            style={{ accentColor: "var(--accent)", cursor: "pointer" }}
            aria-label="Select all programs"
          />
          <span>Select all</span>
        </div>

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
                  handleRename={handleRenameLocal}
                  handleAbandon={handleAbandonClick}
                  loading={loading}
                  selected={selectedIds.has(program.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      {abandonTarget && (
        <AbandonConfirmModal
          open={!!abandonTarget}
          onClose={() => setAbandonTarget(null)}
          onConfirm={handleAbandonConfirm}
          entityType="Program"
          entityName={abandonTarget.entityName}
          entityId={abandonTarget.entityId}
          reasons={abandonReasons}
          loading={abandonLoading}
        />
      )}
    </Modal>
  );
}
