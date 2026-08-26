"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Modal from "./Modal";
import { quarterRange, currentQuarter, isQuarterValid } from "@/lib/quarters";
import { PRIORITY_LABELS } from "@/lib/status";
import { getDefaultSettings } from "@/lib/computation-settings";

type WizardLevel = "framework" | "program" | "project" | "task";
type MoveKey =
  | "framework>program"
  | "program>framework"
  | "program>project"
  | "project>program"
  | "project>task"
  | "task>project";

interface WizardTask {
  id: number;
  taskCode: string;
  name: string;
  assignee: string | null;
}

interface WizardSpecialTask {
  id: number;
  specialTaskCode: string;
  name: string;
}

interface WizardProject {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  tasks: WizardTask[];
  specialTasks: WizardSpecialTask[];
}

interface WizardProgram {
  id: number;
  name: string;
  frameworkId: number;
  projects: WizardProject[];
}

interface WizardFramework {
  id: number;
  name: string;
  color: string;
  programs: WizardProgram[];
}

export interface LevelChangeConfig {
  sourceType: WizardLevel;
  itemIds: number[];
}

interface StatusOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  config: LevelChangeConfig;
  portfolio: WizardFramework[];
  statuses?: StatusOption[];
  onSuccess: () => void;
}

const PRESET_COLORS = [
  "#DBEAFE",
  "#FEE2E2",
  "#D1FAE5",
  "#FEF3C7",
  "#EDE9FE",
  "#FCE7F3",
  "#CCFBF1",
  "#E5E7EB",
];

const LEVEL_LABEL: Record<WizardLevel, string> = {
  framework: "Framework",
  program: "Program",
  project: "Project",
  task: "Task",
};

const LEVEL_PLURAL: Record<WizardLevel, string> = {
  framework: "Frameworks",
  program: "Programs",
  project: "Projects",
  task: "Tasks",
};

interface MoveDef {
  key: MoveKey;
  label: string;
  targetType: WizardLevel;
  destKind?: WizardLevel;
  destLabel?: string;
}

const MOVES_BY_SOURCE: Record<WizardLevel, MoveDef[]> = {
  framework: [
    {
      key: "framework>program",
      label: "Demote to Programs",
      targetType: "program",
      destKind: "framework",
      destLabel: "Move under framework",
    },
  ],
  program: [
    { key: "program>framework", label: "Promote to Frameworks", targetType: "framework" },
    {
      key: "program>project",
      label: "Demote to Projects",
      targetType: "project",
      destKind: "program",
      destLabel: "Move under program",
    },
  ],
  project: [
    {
      key: "project>program",
      label: "Promote to Programs",
      targetType: "program",
      destKind: "framework",
      destLabel: "Move under framework",
    },
    {
      key: "project>task",
      label: "Demote to Tasks",
      targetType: "task",
      destKind: "project",
      destLabel: "Move under project",
    },
  ],
  task: [
    {
      key: "task>project",
      label: "Promote to Projects",
      targetType: "project",
      destKind: "program",
      destLabel: "Move under program",
    },
  ],
};

interface RootInfo {
  id: number;
  name: string;
  level: WizardLevel;
  parentLabel: string;
  projectIds: number[];
}

interface ConvItem {
  oldId: number;
  rootId: number;
  name: string;
  fromLevel: WizardLevel;
  toLevel: WizardLevel;
  needQuarter?: boolean;
  needTaskFields?: boolean;
  needColor?: boolean;
  optRefOwner?: boolean;
}

interface DispItem {
  key: string;
  itemType: "task" | "specialTask";
  id: number;
  label: string;
  groupId: number;
  groupName: string;
}

interface Candidate {
  value: string;
  label: string;
  isNew: boolean;
  programId?: number;
}

interface FieldState {
  quarter?: string;
  code?: string;
  status?: string;
  priority?: string;
  color?: string;
  ref?: string;
  owner?: string;
}

interface Model {
  conversions: ConvItem[];
  roots: RootInfo[];
  displaced: DispItem[];
  candidates: Candidate[];
  suggestedAlloc: Record<string, string>;
  defaultFields: Record<number, FieldState>;
  eligibleDests: { id: number; label: string }[];
  existingProgramNames: Set<string>;
  existingFrameworkNames: Set<string>;
  existingTaskCodes: Set<string>;
  quarterOptions: string[];
}

function sanitizeCodeBase(s: string): string {
  const base = s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return base || "TASK";
}

function getDefaultStatusOptions(): StatusOption[] {
  return getDefaultSettings().statuses.map((s) => ({ id: s.id, name: s.name }));
}

export default function ChangeLevelModal({
  open,
  onClose,
  config,
  portfolio,
  statuses,
  onSuccess,
}: Props) {
  const moves = MOVES_BY_SOURCE[config.sourceType];
  const [moveKey, setMoveKey] = useState<MoveKey>(moves[0].key);
  const [destId, setDestId] = useState(0);
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState<Record<number, FieldState>>({});
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [serverConflicts, setServerConflicts] = useState<string[]>([]);

  const activeMove = moves.find((m) => m.key === moveKey) ?? moves[0];

  const statusOptions: StatusOption[] = useMemo(() => {
    if (statuses && statuses.length > 0) return statuses;
    return getDefaultStatusOptions();
  }, [statuses]);

  const model: Model = useMemo(() => {
    const quarterOptions = [...quarterRange()];
    const cq = currentQuarter();
    if (!quarterOptions.includes(cq)) quarterOptions.unshift(cq);

    const existingProgramNames = new Set<string>();
    const existingFrameworkNames = new Set<string>();
    const existingTaskCodes = new Set<string>();
    const parentProgramOfProject = new Map<number, number>();
    const taskProjectMap = new Map<number, number>();
    const taskById = new Map<number, WizardTask>();
    const projectById = new Map<number, WizardProject>();
    for (const fw of portfolio) {
      existingFrameworkNames.add(fw.name);
      for (const pg of fw.programs) {
        existingProgramNames.add(pg.name);
        for (const pj of pg.projects) {
          parentProgramOfProject.set(pj.id, pg.id);
          projectById.set(pj.id, pj);
          for (const t of pj.tasks) {
            existingTaskCodes.add(t.taskCode);
            taskProjectMap.set(t.id, pj.id);
            taskById.set(t.id, t);
          }
        }
      }
    }

    const roots: RootInfo[] = [];
    const conversions: ConvItem[] = [];
    const displaced: DispItem[] = [];

    function pushDisplaced(pj: WizardProject, rootId: number, includeTasks: boolean) {
      if (includeTasks) {
        for (const t of pj.tasks) {
          displaced.push({
            key: `task:${t.id}`,
            itemType: "task",
            id: t.id,
            label: `${t.taskCode} — ${t.name}`,
            groupId: pj.id,
            groupName: pj.name,
          });
        }
      }
      for (const st of pj.specialTasks) {
        displaced.push({
          key: `specialTask:${st.id}`,
          itemType: "specialTask",
          id: st.id,
          label: `${st.specialTaskCode} — ${st.name}`,
          groupId: pj.id,
          groupName: pj.name,
        });
      }
      void rootId;
    }

    if (config.sourceType === "framework") {
      for (const fw of portfolio.filter((f) => config.itemIds.includes(f.id))) {
        roots.push({
          id: fw.id,
          name: fw.name,
          level: "framework",
          parentLabel: "top level",
          projectIds: fw.programs.flatMap((p) => p.projects.map((pj) => pj.id)),
        });
        conversions.push({
          oldId: fw.id,
          rootId: fw.id,
          name: fw.name,
          fromLevel: "framework",
          toLevel: "program",
        });
        for (const pg of fw.programs) {
          conversions.push({
            oldId: pg.id,
            rootId: fw.id,
            name: pg.name,
            fromLevel: "program",
            toLevel: "project",
            needQuarter: true,
          });
          for (const pj of pg.projects) {
            conversions.push({
              oldId: pj.id,
              rootId: fw.id,
              name: pj.name,
              fromLevel: "project",
              toLevel: "task",
              needTaskFields: true,
            });
            pushDisplaced(pj, fw.id, true);
          }
        }
      }
    } else if (config.sourceType === "program") {
      for (const fw of portfolio) {
        for (const pg of fw.programs.filter((p) => config.itemIds.includes(p.id))) {
          roots.push({
            id: pg.id,
            name: pg.name,
            level: "program",
            parentLabel: fw.name,
            projectIds: pg.projects.map((pj) => pj.id),
          });
          if (moveKey === "program>framework") {
            conversions.push({
              oldId: pg.id,
              rootId: pg.id,
              name: pg.name,
              fromLevel: "program",
              toLevel: "framework",
              needColor: true,
            });
            for (const pj of pg.projects) {
              conversions.push({
                oldId: pj.id,
                rootId: pg.id,
                name: pj.name,
                fromLevel: "project",
                toLevel: "program",
              });
              for (const t of pj.tasks) {
                conversions.push({
                  oldId: t.id,
                  rootId: pg.id,
                  name: t.name,
                  fromLevel: "task",
                  toLevel: "project",
                  optRefOwner: true,
                });
              }
              pushDisplaced(pj, pg.id, false);
            }
          } else {
            conversions.push({
              oldId: pg.id,
              rootId: pg.id,
              name: pg.name,
              fromLevel: "program",
              toLevel: "project",
              needQuarter: true,
            });
            for (const pj of pg.projects) {
              conversions.push({
                oldId: pj.id,
                rootId: pg.id,
                name: pj.name,
                fromLevel: "project",
                toLevel: "task",
                needTaskFields: true,
              });
              pushDisplaced(pj, pg.id, true);
            }
          }
        }
      }
    } else if (config.sourceType === "project") {
      for (const fw of portfolio) {
        for (const pg of fw.programs) {
          for (const pj of pg.projects.filter((p) => config.itemIds.includes(p.id))) {
            roots.push({
              id: pj.id,
              name: pj.name,
              level: "project",
              parentLabel: `${pg.name} · ${fw.name}`,
              projectIds: [],
            });
            if (moveKey === "project>program") {
              conversions.push({
                oldId: pj.id,
                rootId: pj.id,
                name: pj.name,
                fromLevel: "project",
                toLevel: "program",
              });
              for (const t of pj.tasks) {
                conversions.push({
                  oldId: t.id,
                  rootId: pj.id,
                  name: t.name,
                  fromLevel: "task",
                  toLevel: "project",
                  optRefOwner: true,
                });
              }
              pushDisplaced(pj, pj.id, false);
            } else {
              conversions.push({
                oldId: pj.id,
                rootId: pj.id,
                name: pj.name,
                fromLevel: "project",
                toLevel: "task",
                needTaskFields: true,
              });
              pushDisplaced(pj, pj.id, true);
            }
          }
        }
      }
    } else {
      for (const fw of portfolio) {
        for (const pg of fw.programs) {
          for (const pj of pg.projects) {
            for (const t of pj.tasks.filter((x) => config.itemIds.includes(x.id))) {
              roots.push({
                id: t.id,
                name: `${t.taskCode} — ${t.name}`,
                level: "task",
                parentLabel: `${pj.name} · ${pg.name}`,
                projectIds: [],
              });
              conversions.push({
                oldId: t.id,
                rootId: t.id,
                name: t.name,
                fromLevel: "task",
                toLevel: "project",
                optRefOwner: true,
              });
            }
          }
        }
      }
    }

    const deletedProjectIds = new Set<number>();
    const newProjectSources: { oldId: number; name: string }[] = [];
    if (moveKey === "framework>program") {
      for (const c of conversions.filter((x) => x.toLevel === "project")) {
        deletedProjectIds.add(c.oldId);
        newProjectSources.push({ oldId: c.oldId, name: c.name });
      }
      for (const c of conversions.filter((x) => x.fromLevel === "project")) {
        deletedProjectIds.add(c.oldId);
      }
    } else if (moveKey === "program>framework") {
      for (const c of conversions.filter((x) => x.fromLevel === "project")) {
        deletedProjectIds.add(c.oldId);
      }
      for (const c of conversions.filter((x) => x.toLevel === "project")) {
        newProjectSources.push({ oldId: c.oldId, name: c.name });
      }
    } else if (moveKey === "program>project") {
      for (const c of conversions.filter((x) => x.fromLevel === "project")) {
        deletedProjectIds.add(c.oldId);
      }
      for (const r of roots) newProjectSources.push({ oldId: r.id, name: r.name });
    } else if (moveKey === "project>program") {
      for (const r of roots) deletedProjectIds.add(r.id);
      for (const c of conversions.filter((x) => x.toLevel === "project")) {
        newProjectSources.push({ oldId: c.oldId, name: c.name });
      }
    } else if (moveKey === "project>task") {
      for (const r of roots) deletedProjectIds.add(r.id);
    }

    const newByOldId = new Map<number, string>();
    for (const src of newProjectSources) newByOldId.set(src.oldId, `n:${src.oldId}`);
    const newsBySourceProject = new Map<number, string>();
    for (const src of newProjectSources) {
      const pid = taskProjectMap.get(src.oldId);
      if (pid !== undefined && !newsBySourceProject.has(pid)) {
        newsBySourceProject.set(pid, `n:${src.oldId}`);
      }
    }

    const candidates: Candidate[] = newProjectSources.map((src) => ({
      value: `n:${src.oldId}`,
      label: `New · ${src.name}`,
      isNew: true,
    }));
    for (const fw of portfolio) {
      for (const pg of fw.programs) {
        for (const pj of pg.projects) {
          if (!deletedProjectIds.has(pj.id)) {
            candidates.push({
              value: `s:${pj.id}`,
              label: `${pj.name} (${pg.name})`,
              isNew: false,
              programId: pg.id,
            });
          }
        }
      }
    }

    const promoteCase =
      moveKey === "program>framework" || moveKey === "project>program";
    const demoteWithNewsCase =
      moveKey === "framework>program" || moveKey === "program>project";

    function suggestTarget(groupId: number): string {
      if (promoteCase) {
        const direct = newsBySourceProject.get(groupId);
        if (direct) return direct;
        const firstNew = candidates.find((c) => c.isNew);
        if (firstNew) return firstNew.value;
      }
      if (demoteWithNewsCase) {
        const parentId = parentProgramOfProject.get(groupId);
        if (parentId !== undefined) {
          const direct = newByOldId.get(parentId);
          if (direct) return direct;
        }
      }
      const progId = parentProgramOfProject.get(groupId);
      if (progId !== undefined) {
        const sib = candidates.find((c) => !c.isNew && c.programId === progId);
        if (sib) return sib.value;
      }
      const anySurvivor = candidates.find((c) => !c.isNew);
      return anySurvivor ? anySurvivor.value : candidates[0]?.value ?? "";
    }

    const suggestedAlloc: Record<string, string> = {};
    for (const d of displaced) {
      suggestedAlloc[d.key] = suggestTarget(d.groupId);
    }

    const defaultFields: Record<number, FieldState> = {};
    let colorIdx = 0;
    const assignedCodes = new Set(existingTaskCodes);
    for (const c of conversions) {
      const fs: FieldState = { ...(fields[c.oldId] ?? {}) };
      if (c.needQuarter) fs.quarter = fs.quarter ?? cq;
      if (c.needTaskFields) {
        if (!fs.code?.trim()) {
          const pj = projectById.get(c.oldId);
          const base = sanitizeCodeBase(pj?.reference || pj?.name || c.name || "TASK");
          let n = 1;
          while (assignedCodes.has(`${base}-T${n}`)) n++;
          fs.code = `${base}-T${n}`;
        }
        assignedCodes.add(fs.code.trim());
        fs.status = fs.status ?? statusOptions[0]?.name ?? "";
        fs.priority = fs.priority ?? "Low";
      }
      if (c.needColor) fs.color = fs.color ?? PRESET_COLORS[colorIdx++ % PRESET_COLORS.length];
      if (c.optRefOwner && !("ref" in fs)) {
        const t = taskById.get(c.oldId);
        fs.ref = t?.taskCode ?? "";
        fs.owner = t?.assignee ?? "";
      }
      defaultFields[c.oldId] = fs;
    }

    const eligibleDests: { id: number; label: string }[] = [];
    if (activeMove.destKind === "framework") {
      for (const fw of portfolio) {
        if (!config.itemIds.includes(fw.id)) eligibleDests.push({ id: fw.id, label: fw.name });
      }
    } else if (activeMove.destKind === "program") {
      for (const fw of portfolio) {
        for (const pg of fw.programs) {
          if (!config.itemIds.includes(pg.id)) {
            eligibleDests.push({ id: pg.id, label: `${pg.name} (${fw.name})` });
          }
        }
      }
    } else if (activeMove.destKind === "project") {
      for (const fw of portfolio) {
        for (const pg of fw.programs) {
          for (const pj of pg.projects) {
            if (!config.itemIds.includes(pj.id)) {
              eligibleDests.push({ id: pj.id, label: `${pj.name} (${pg.name})` });
            }
          }
        }
      }
    }

    return {
      conversions,
      roots,
      displaced,
      candidates,
      suggestedAlloc,
      defaultFields,
      eligibleDests,
      existingProgramNames,
      existingFrameworkNames,
      existingTaskCodes,
      quarterOptions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio, config, moveKey]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setServerError("");
      setServerConflicts([]);
    }
  }, [open]);

  useEffect(() => {
    setFields(model.defaultFields);
    setAllocs(model.suggestedAlloc);
    setDestId(model.eligibleDests[0]?.id ?? 0);
  }, [model]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  const clientConflicts = useMemo(() => {
    const out: string[] = [];
    if (activeMove.destKind && !destId) {
      out.push(`Pick a ${activeMove.destKind} to move into`);
    }
    const seenNames = new Set<string>();
    const seenCodes = new Set<string>();
    for (const c of model.conversions) {
      const fs = fields[c.oldId] ?? {};
      if (c.needQuarter && (!fs.quarter || !isQuarterValid(fs.quarter))) {
        out.push(`"${c.name}": pick a valid target quarter`);
      }
      if (c.needTaskFields) {
        const code = fs.code?.trim() ?? "";
        if (!code) out.push(`"${c.name}": enter a task code`);
        if (!fs.status) out.push(`"${c.name}": pick a status`);
        if (code) {
          if (seenCodes.has(code)) out.push(`Task code "${code}" is used twice`);
          else if (model.existingTaskCodes.has(code)) out.push(`Task code "${code}" already exists`);
          seenCodes.add(code);
        }
      }
      if (c.toLevel === "program" || c.toLevel === "framework") {
        if (seenNames.has(c.name)) {
          out.push(`"${c.name}" appears more than once — ${c.toLevel} names must be unique`);
        } else if (c.toLevel === "program" && model.existingProgramNames.has(c.name)) {
          out.push(`A program named "${c.name}" already exists`);
        } else if (c.toLevel === "framework" && model.existingFrameworkNames.has(c.name)) {
          out.push(`A framework named "${c.name}" already exists`);
        }
        seenNames.add(c.name);
      }
    }
    for (const d of model.displaced) {
      if (!allocs[d.key]) out.push(`"${d.label}" needs a target project`);
    }
    return [...new Set(out)];
  }, [model, fields, allocs, destId, activeMove]);

  const taskFieldItems = model.conversions.filter((c) => c.needTaskFields);
  const quarterItems = model.conversions.filter((c) => c.needQuarter);
  const colorItems = model.conversions.filter((c) => c.needColor);
  const refOwnerItems = model.conversions.filter((c) => c.optRefOwner);

  function updateField(id: number, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function applyAllQuarters(q: string) {
    setFields((prev) => {
      const next = { ...prev };
      for (const c of quarterItems) next[c.oldId] = { ...next[c.oldId], quarter: q };
      return next;
    });
  }

  function applyAllTaskField(patch: Partial<Pick<FieldState, "status" | "priority">>) {
    setFields((prev) => {
      const next = { ...prev };
      for (const c of taskFieldItems) next[c.oldId] = { ...next[c.oldId], ...patch };
      return next;
    });
  }

  function applyAllTargets(value: string) {
    setAllocs((prev) => {
      const next = { ...prev };
      for (const d of model.displaced) next[d.key] = value;
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setServerError("");
    setServerConflicts([]);
    try {
      const payloadFields: Record<string, Record<string, string>> = {};
      for (const c of model.conversions) {
        const fs = fields[c.oldId] ?? {};
        const picked: Record<string, string> = {};
        if (c.needQuarter) picked.targetQuarter = fs.quarter ?? "";
        if (c.needTaskFields) {
          picked.taskCode = fs.code?.trim() ?? "";
          picked.status = fs.status ?? "";
          picked.priority = fs.priority ?? "";
        }
        if (c.needColor) picked.color = fs.color ?? "";
        if (c.optRefOwner) {
          picked.reference = fs.ref ?? "";
          picked.owner = fs.owner ?? "";
        }
        payloadFields[String(c.oldId)] = picked;
      }
      const res = await fetch("/api/change-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: config.sourceType,
          targetType: activeMove.targetType,
          itemIds: config.itemIds,
          destinationParentId: activeMove.destKind ? destId : undefined,
          fields: payloadFields,
          allocations: model.displaced.map((d) => {
            const raw = allocs[d.key] ?? "";
            const pid = parseInt(raw.slice(2), 10);
            return {
              itemType: d.itemType,
              itemId: d.id,
              projectId: Number.isInteger(pid) ? pid : 0,
            };
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(data.error || "Failed to change level");
        setServerConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
        return;
      }
      onSuccess();
    } catch {
      setServerError("Save failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const inputStyle: CSSProperties = {
    border: "1px solid var(--rule-strong)",
    borderRadius: 3,
    padding: "4px 8px",
    fontSize: 12,
    color: "var(--ink-primary)",
    background: "var(--surface)",
  };

  const sectionLabelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--ink-tertiary)",
    margin: "0 0 6px",
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Level" wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
          {["Configure", "Allocate", "Confirm"].map((label, i) => (
            <span
              key={label}
              style={{
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: step === i + 1 ? "var(--accent)" : "var(--ink-tertiary)",
              }}
            >
              {i + 1}. {label}
              {i < 2 ? " →" : ""}
            </span>
          ))}
        </div>

        <div
          style={{
            background: "var(--ground)",
            borderRadius: 4,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--ink-secondary)",
          }}
        >
          {model.roots.length} selected{" "}
          {model.roots.length === 1 ? LEVEL_LABEL[config.sourceType] : LEVEL_LABEL[config.sourceType] + "s"}:{" "}
          <strong style={{ color: "var(--ink-primary)" }}>
            {model.roots.map((r) => r.name).join(", ")}
          </strong>
        </div>

        {step === 1 && (
          <>
            {moves.length > 1 && (
              <div>
                <p style={sectionLabelStyle}>New level</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {moves.map((m) => (
                    <label
                      key={m.key}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}
                    >
                      <input
                        type="radio"
                        name="move"
                        checked={moveKey === m.key}
                        onChange={() => setMoveKey(m.key)}
                      />
                      {LEVEL_LABEL[config.sourceType]} → {LEVEL_LABEL[m.targetType]} ({LEVEL_PLURAL[m.targetType]})
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeMove.destKind && (
              <div>
                <p style={sectionLabelStyle}>{activeMove.destLabel}</p>
                {model.eligibleDests.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#B91C1C", margin: 0 }}>
                    No eligible {activeMove.destKind} available. Create one first.
                  </p>
                ) : (
                  <select
                    value={destId}
                    onChange={(e) => setDestId(parseInt(e.target.value, 10))}
                    style={{ ...inputStyle, minWidth: 260 }}
                  >
                    {model.eligibleDests.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {quarterItems.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ ...sectionLabelStyle, marginBottom: 0 }}>Target quarter for converted projects</p>
                  <select value="" onChange={(e) => e.target.value && applyAllQuarters(e.target.value)} style={inputStyle}>
                    <option value="">Apply to all…</option>
                    {model.quarterOptions.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {quarterItems.map((c) => (
                    <div key={c.oldId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <select
                        value={fields[c.oldId]?.quarter ?? ""}
                        onChange={(e) => updateField(c.oldId, { quarter: e.target.value })}
                        style={inputStyle}
                      >
                        {model.quarterOptions.map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {taskFieldItems.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>Apply to all:</span>
                  <select
                    value=""
                    onChange={(e) => e.target.value && applyAllTaskField({ status: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Status…</option>
                    {statusOptions.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value=""
                    onChange={(e) => e.target.value && applyAllTaskField({ priority: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Priority…</option>
                    {PRIORITY_LABELS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 170px 90px", gap: "4px 8px", fontSize: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-tertiary)" }}>Converted item</span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-tertiary)" }}>Task code</span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-tertiary)" }}>Status</span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-tertiary)" }}>Priority</span>
                  {taskFieldItems.map((c) => {
                    const fs = fields[c.oldId] ?? {};
                    return (
                      <FragmentInGrid key={c.oldId} c={c} fs={fs} updateField={updateField} statusOptions={statusOptions} inputStyle={inputStyle} />
                    );
                  })}
                </div>
              </div>
            )}

            {colorItems.length > 0 && (
              <div>
                <p style={sectionLabelStyle}>Framework colors</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {colorItems.map((c) => (
                    <div key={c.oldId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {PRESET_COLORS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateField(c.oldId, { color: hex })}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              border:
                                (fields[c.oldId]?.color ?? "") === hex
                                  ? "2px solid #1F2937"
                                  : "2px solid var(--rule-strong)",
                              backgroundColor: hex,
                              cursor: "pointer",
                            }}
                            title={hex}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {refOwnerItems.length > 0 && (
              <div>
                <p style={sectionLabelStyle}>Optional project fields</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {refOwnerItems.map((c) => {
                    const fs = fields[c.oldId] ?? {};
                    return (
                      <div key={c.oldId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ flex: 1 }}>{c.name}</span>
                        <input
                          type="text"
                          placeholder="Reference"
                          value={fs.ref ?? ""}
                          onChange={(e) => updateField(c.oldId, { ref: e.target.value })}
                          style={{ ...inputStyle, width: 160 }}
                        />
                        <input
                          type="text"
                          placeholder="Owner"
                          value={fs.owner ?? ""}
                          onChange={(e) => updateField(c.oldId, { owner: e.target.value })}
                          style={{ ...inputStyle, width: 160 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {clientConflicts.length > 0 && (
              <ConflictBlock conflicts={clientConflicts} />
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p style={sectionLabelStyle}>What will happen</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {model.roots.map((r) => {
                  const convs = model.conversions.filter((c) => c.rootId === r.id);
                  const relevantGroups = new Set<number>([r.id]);
                  for (const c of convs) relevantGroups.add(c.oldId);
                  const dispCount = model.displaced.filter(
                    (d) => relevantGroups.has(d.groupId) || r.projectIds.includes(d.groupId)
                  ).length;
                  const destName =
                    model.eligibleDests.find((o) => o.id === destId)?.label ?? "—";
                  const levelCounts = convs
                    .filter((c) => c.oldId !== r.id)
                    .reduce<Record<string, number>>((acc, c) => {
                      acc[c.toLevel] = (acc[c.toLevel] ?? 0) + 1;
                      return acc;
                    }, {});
                  return (
                    <div
                      key={r.id}
                      style={{ border: "1px solid var(--rule)", borderRadius: 3, padding: "8px 12px", fontSize: 12 }}
                    >
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--ink-primary)" }}>
                        {LEVEL_LABEL[r.level]} “{r.name}” → {LEVEL_LABEL[activeMove.targetType]}
                        {activeMove.destKind ? ` under ${destName}` : " (top level)"}
                      </p>
                      {Object.entries(levelCounts).map(([lvl, count]) => (
                        <p key={lvl} style={{ margin: "4px 0 0", color: "var(--ink-secondary)" }}>
                          · {count} {count === 1 ? LEVEL_LABEL[lvl as WizardLevel].toLowerCase() : LEVEL_PLURAL[lvl as WizardLevel].toLowerCase()} become{" "}
                          {LEVEL_PLURAL[lvl as WizardLevel]}
                        </p>
                      ))}
                      {dispCount > 0 && (
                        <p style={{ margin: "4px 0 0", color: "var(--ink-secondary)" }}>
                          · {dispCount} item{dispCount !== 1 ? "s" : ""} reassigned below
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {model.displaced.length > 0 ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ ...sectionLabelStyle, marginBottom: 0 }}>
                    Allocate displaced items ({model.displaced.length})
                  </p>
                  <select value="" onChange={(e) => e.target.value && applyAllTargets(e.target.value)} style={inputStyle}>
                    <option value="">Send all to…</option>
                    {model.candidates.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {model.displaced.map((d) => (
                    <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 2,
                          letterSpacing: "0.04em",
                          background: d.itemType === "specialTask" ? "#EDE9FE" : "#DBEAFE",
                          color: "#374151",
                          flexShrink: 0,
                        }}
                      >
                        {d.itemType === "specialTask" ? "ST" : "T"}
                      </span>
                      <span
                        style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={`${d.label} (was in ${d.groupName})`}
                      >
                        {d.label}
                      </span>
                      <select
                        value={allocs[d.key] ?? ""}
                        onChange={(e) => setAllocs((prev) => ({ ...prev, [d.key]: e.target.value }))}
                        style={{ ...inputStyle, width: 220, flexShrink: 0 }}
                      >
                        {!allocs[d.key] && <option value="">Choose project…</option>}
                        {model.candidates.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--ink-tertiary)", margin: 0 }}>
                No tasks or special tasks will be displaced by this change.
              </p>
            )}

            {(serverError || clientConflicts.length > 0) && (
              <ConflictBlock conflicts={[serverError, ...serverConflicts, ...clientConflicts]} />
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ background: "var(--ground)", borderRadius: 4, padding: "12px 16px", fontSize: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--ink-primary)" }}>Summary</p>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-secondary)" }}>
                <li>
                  {model.roots.length} {LEVEL_LABEL[config.sourceType].toLowerCase()}
                  {model.roots.length !== 1 ? "s" : ""} will become{" "}
                  {model.roots.length === 1 ? "a" : ""} {activeMove.targetType}
                  {model.roots.length !== 1 ? "s" : ""}
                  {activeMove.destKind
                    ? ` under “${model.eligibleDests.find((o) => o.id === destId)?.label ?? "—"}”`
                    : " at the top level"}
                  .
                </li>
                <li>{model.conversions.length} items total will be recreated at their new levels.</li>
                <li>
                  {model.displaced.length} displaced item{model.displaced.length !== 1 ? "s" : ""} will move to the
                  projects chosen in step 2.
                </li>
              </ul>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-secondary)", margin: 0 }}>
                This restructures your portfolio and cannot be undone. Items get new IDs, so historical views will show
                them at their new location.
              </p>
            </div>
            {serverError && <ConflictBlock conflicts={[serverError, ...serverConflicts]} />}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              disabled={submitting}
              style={{
                marginRight: "auto",
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-primary)",
                background: "var(--surface)",
                border: "1px solid var(--rule-strong)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-primary)",
              background: "var(--surface)",
              border: "1px solid var(--rule-strong)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={clientConflicts.length > 0}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                background: clientConflicts.length > 0 ? "var(--rule)" : "var(--accent)",
                border: "none",
                borderRadius: 3,
                cursor: clientConflicts.length > 0 ? "not-allowed" : "pointer",
                opacity: clientConflicts.length > 0 ? 0.5 : 1,
              }}
            >
              {step === 1 ? "Review Allocation" : "Review Summary"}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || clientConflicts.length > 0}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                background: "#B91C1C",
                border: "none",
                borderRadius: 3,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Applying…" : "Apply Level Change"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function FragmentInGrid({
  c,
  fs,
  updateField,
  statusOptions,
  inputStyle,
}: {
  c: ConvItem;
  fs: FieldState;
  updateField: (id: number, patch: Partial<FieldState>) => void;
  statusOptions: StatusOption[];
  inputStyle: CSSProperties;
}) {
  return (
    <>
      <span>{c.name}</span>
      <input
        type="text"
        value={fs.code ?? ""}
        onChange={(e) => updateField(c.oldId, { code: e.target.value })}
        style={inputStyle}
      />
      <select
        value={fs.status ?? ""}
        onChange={(e) => updateField(c.oldId, { status: e.target.value })}
        style={inputStyle}
      >
        {statusOptions.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        value={fs.priority ?? ""}
        onChange={(e) => updateField(c.oldId, { priority: e.target.value })}
        style={inputStyle}
      >
        {PRIORITY_LABELS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </>
  );
}

function ConflictBlock({ conflicts }: { conflicts: string[] }) {
  const cleaned = conflicts.filter(Boolean);
  if (cleaned.length === 0) return null;
  return (
    <div style={{ background: "#FEF2F2", borderRadius: 4, padding: "10px 14px" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C", margin: "0 0 4px" }}>Resolve before continuing:</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#B91C1C" }}>
        {cleaned.slice(0, 8).map((c, i) => (
          <li key={`${i}:${c}`}>{c}</li>
        ))}
        {cleaned.length > 8 && <li>…and {cleaned.length - 8} more</li>}
      </ul>
    </div>
  );
}
