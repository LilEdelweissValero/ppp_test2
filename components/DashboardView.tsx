"use client";

import { useState, useMemo } from "react";
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
import { quarterRange } from "@/lib/quarters";
import {
  computeProjectPercentComplete,
  computeProjectHealth,
  computeProjectDerivedStatus,
} from "@/lib/health";
import { countTasksByStatus, countTasksByStatusForQuarter } from "@/lib/status";
import HealthBadge from "@/components/HealthBadge";
import ProjectFormModal from "@/components/ProjectFormModal";
import ManageFrameworksModal from "@/components/ManageFrameworksModal";
import ManageProgramsModal from "@/components/ManageProgramsModal";
import ImportCsvModal from "@/components/ImportCsvModal";

interface Task {
  id: number;
  taskCode: string;
  name: string;
  status: string;
  adjustedTargetQuarter: string;
}

interface Project {
  id: number;
  name: string;
  programId: number;
  programName: string;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  actualCompletionDate: string | null;
  tasks: Task[];
}

interface Framework {
  id: number;
  name: string;
  color: string;
  projects: Project[];
}

interface Props {
  frameworks: Framework[];
}

const grayBg = "bg-gray-50";
const ALL_TIME = "all";

function filterTasksByQuarter(tasks: Task[], selectedQuarter: string): Task[] {
  if (selectedQuarter === ALL_TIME) return tasks;
  return tasks.filter((t) => t.adjustedTargetQuarter === selectedQuarter);
}

function SortableProjectRow({
  project,
  grayBg,
  onClick,
  selectedQuarter,
}: {
  project: Project;
  grayBg: string;
  onClick: () => void;
  selectedQuarter: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const filteredTasks = filterTasksByQuarter(project.tasks, selectedQuarter);
  const pct = computeProjectPercentComplete(filteredTasks);
  const health =
    filteredTasks.length > 0
      ? computeProjectHealth(pct * 100, project.adjustedTargetQuarter)
      : null;
  const counts = selectedQuarter === ALL_TIME
    ? countTasksByStatus(project.tasks)
    : countTasksByStatusForQuarter(project.tasks, selectedQuarter);
  const derivedStatus = computeProjectDerivedStatus(filteredTasks);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-t border-gray-100 hover:bg-blue-50"
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
      <td
        className="px-4 py-2 font-medium text-blue-600 cursor-pointer"
        onClick={onClick}
      >
        {project.name}
      </td>
      <td className="px-4 py-2 text-gray-700">{project.programName}</td>
      <td className="px-4 py-2 text-gray-600">{project.reference || "-"}</td>
      <td className={`px-4 py-2 text-center ${grayBg}`}>
        {filteredTasks.length}
      </td>
      <td className={`px-4 py-2 text-center ${grayBg}`}>
        {counts["Not Yet Started"]}
      </td>
      <td className={`px-4 py-2 text-center ${grayBg}`}>
        {counts["In Progress, Planning or Initiated"]}
      </td>
      <td className={`px-4 py-2 text-center ${grayBg}`}>
        {counts["In Progress, Partial"]}
      </td>
      <td className={`px-4 py-2 text-center ${grayBg}`}>
        {counts["In Progress, Mostly Done or Testing"]}
      </td>
      <td className={`px-4 py-2 text-center ${grayBg}`}>
        {counts["Complete or Verified"]}
      </td>
      <td className={`px-4 py-2 text-gray-600 ${grayBg}`}>
        {project.targetQuarter}
      </td>
      <td className={`px-4 py-2 text-gray-600 ${grayBg}`}>
        {project.adjustedTargetQuarter}
      </td>
      <td className={`px-4 py-2 text-gray-600 ${grayBg}`}>
        {project.actualCompletionDate || "-"}
      </td>
      <td className={`px-4 py-2 ${grayBg}`}>
        <span
          className={`text-xs font-medium ${
            derivedStatus === "Completed"
              ? "text-green-700"
              : "text-blue-700"
          }`}
        >
          {derivedStatus}
        </span>
      </td>
      <td className={`px-4 py-2 text-center ${grayBg}`}>
        {Math.round(pct * 100)}%
      </td>
      <td className="px-4 py-2">
        <HealthBadge health={health} />
      </td>
    </tr>
  );
}

export default function DashboardView({ frameworks }: Props) {
  const router = useRouter();
  const [selectedQuarter, setSelectedQuarter] = useState(ALL_TIME);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [showAddProject, setShowAddProject] = useState(false);
  const [showManageFrameworks, setShowManageFrameworks] = useState(false);
  const [showManagePrograms, setShowManagePrograms] = useState(false);
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [frameworkProjects, setFrameworkProjects] = useState<
    Record<number, Project[]>
  >({});

  const quarters = [ALL_TIME, ...quarterRange(2, 2)];

  const filteredFrameworks = useMemo(() => {
    const q = search.toLowerCase();
    return frameworks
      .map((fw) => ({
        ...fw,
        projects: frameworkProjects[fw.id] ?? fw.projects,
      }))
      .map((fw) => ({
        ...fw,
        projects: fw.projects.filter(
          (p) => !q || p.name.toLowerCase().includes(q)
        ),
      }))
      .filter((fw) => !q || fw.projects.length > 0);
  }, [frameworks, search, frameworkProjects]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function toggleCollapse(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllCollapse() {
    if (collapsed.size === filteredFrameworks.length) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(filteredFrameworks.map((f) => f.id)));
    }
  }

  function handleRefresh() {
    router.refresh();
  }

  async function handleProjectDragEnd(fwId: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentProjects = frameworkProjects[fwId] ?? frameworks.find(f => f.id === fwId)?.projects ?? [];
    const oldIndex = currentProjects.findIndex((p) => p.id === active.id);
    const newIndex = currentProjects.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(currentProjects, oldIndex, newIndex);

    setFrameworkProjects((prev) => ({ ...prev, [fwId]: reordered }));

    await fetch("/api/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "project",
        orderedIds: reordered.map((p) => p.id),
      }),
    });
    handleRefresh();
  }

  const allCollapsed =
    collapsed.size === filteredFrameworks.length && filteredFrameworks.length > 0;

  return (
    <div>
      <div className="flex items-end gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quarter
          </label>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {quarters.map((q) => (
              <option key={q} value={q}>
                {q === ALL_TIME ? "All Time" : q}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Projects
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by project name..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={() => setShowAddProject(true)}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          Add Project
        </button>
        <button
          onClick={() => setShowManageFrameworks(true)}
          className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Manage Frameworks
        </button>
        <button
          onClick={() => setShowManagePrograms(true)}
          className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Manage Programs
        </button>
        <button
          onClick={() => setShowImportCsv(true)}
          className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Import CSV
        </button>
      </div>

      {filteredFrameworks.length === 0 && (
        <p className="text-gray-500 text-sm">
          No frameworks or projects found. Add a framework, project, or import a
          CSV to get started.
        </p>
      )}

      {filteredFrameworks.length > 0 && (
        <div className="mb-2 flex items-center gap-3 text-xs">
          <button
            onClick={toggleAllCollapse}
            className="text-gray-500 hover:text-gray-700"
          >
            {allCollapsed ? "Expand All" : "Collapse All"}
          </button>
        </div>
      )}

      {filteredFrameworks.map((fw) => {
        const isCollapsed = collapsed.has(fw.id);
        const hasProjects = fw.projects.length > 0;

        const allFrameworkTasks = fw.projects.flatMap((p) => p.tasks);
        const frameworkFilteredTasks = filterTasksByQuarter(allFrameworkTasks, selectedQuarter);
        const frameworkCounts = selectedQuarter === ALL_TIME
          ? countTasksByStatus(allFrameworkTasks)
          : countTasksByStatusForQuarter(allFrameworkTasks, selectedQuarter);
        const frameworkTotalTasks = frameworkFilteredTasks.length;

        return (
          <div
            key={fw.id}
            className="border border-gray-200 rounded-lg mb-4"
          >
            {hasProjects ? (
              <button
                onClick={() => toggleCollapse(fw.id)}
                className="w-full flex items-center px-4 py-3 rounded-t-lg text-left"
                style={{ backgroundColor: fw.color }}
              >
                <span className="text-gray-600 text-sm mr-3">
                  {isCollapsed ? "\u25B6" : "\u25BC"}
                </span>
                <span className="font-semibold text-gray-900">{fw.name}</span>
              </button>
            ) : (
              <div
                className="flex items-center px-4 py-3 rounded-t-lg"
                style={{ backgroundColor: fw.color }}
              >
                <span className="font-semibold text-gray-900">{fw.name}</span>
              </div>
            )}

            {!isCollapsed && hasProjects && (
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ minWidth: "1400px" }}>
                  <thead>
                    <tr className="bg-slate-800 text-white text-left">
                      <th className="px-4 py-2 font-bold w-[40px]"></th>
                      <th className="px-4 py-2 font-bold w-[160px]">PROJECT</th>
                      <th className="px-4 py-2 font-bold w-[130px]">PROGRAM</th>
                      <th className="px-4 py-2 font-bold w-[100px]">REFERENCE</th>
                      <th className={`px-4 py-2 font-bold w-[70px] ${grayBg} text-gray-700`}>NUMBER OF TASKS</th>
                      <th className={`px-4 py-2 font-bold w-[70px] ${grayBg} text-gray-700`}>Not Yet Started</th>
                      <th className={`px-4 py-2 font-bold w-[70px] ${grayBg} text-gray-700`}>In Progress, Planning or Initiated</th>
                      <th className={`px-4 py-2 font-bold w-[70px] ${grayBg} text-gray-700`}>In Progress, Partial</th>
                      <th className={`px-4 py-2 font-bold w-[70px] ${grayBg} text-gray-700`}>In Progress, Mostly Done or Testing</th>
                      <th className={`px-4 py-2 font-bold w-[70px] ${grayBg} text-gray-700`}>Complete or Verified</th>
                      <th className={`px-4 py-2 font-bold w-[100px] ${grayBg} text-gray-700`}>TARGET DATE</th>
                      <th className={`px-4 py-2 font-bold w-[100px] ${grayBg} text-gray-700`}>ADJUSTED TARGET DATE</th>
                      <th className={`px-4 py-2 font-bold w-[110px] ${grayBg} text-gray-700`}>ACTUAL COMPLETION DATE</th>
                      <th className={`px-4 py-2 font-bold w-[90px] ${grayBg} text-gray-700`}>STATUS</th>
                      <th className={`px-4 py-2 font-bold w-[80px] ${grayBg} text-gray-700`}>PERCENT COMPLETION</th>
                      <th className="px-4 py-2 font-bold w-[100px]">PROJECT HEALTH</th>
                    </tr>
                    <tr className="bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-700">
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2" colSpan={3}>TOTAL</td>
                      <td className="px-4 py-2 text-center">{frameworkTotalTasks}</td>
                      <td className="px-4 py-2 text-center">{frameworkCounts["Not Yet Started"]}</td>
                      <td className="px-4 py-2 text-center">{frameworkCounts["In Progress, Planning or Initiated"]}</td>
                      <td className="px-4 py-2 text-center">{frameworkCounts["In Progress, Partial"]}</td>
                      <td className="px-4 py-2 text-center">{frameworkCounts["In Progress, Mostly Done or Testing"]}</td>
                      <td className="px-4 py-2 text-center">{frameworkCounts["Complete or Verified"]}</td>
                      <td className="px-4 py-2" colSpan={7}></td>
                    </tr>
                  </thead>
                  <tbody>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleProjectDragEnd(fw.id, event)}
                    >
                      <SortableContext
                        items={fw.projects.map((p) => p.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {fw.projects.map((project) => (
                          <SortableProjectRow
                            key={project.id}
                            project={project}
                            grayBg={grayBg}
                            selectedQuarter={selectedQuarter}
                            onClick={() =>
                              router.push(`/projects/${project.id}`)
                            }
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <ProjectFormModal
        open={showAddProject}
        onClose={() => setShowAddProject(false)}
        onSave={handleRefresh}
      />
      <ManageFrameworksModal
        open={showManageFrameworks}
        onClose={() => setShowManageFrameworks(false)}
        onSave={handleRefresh}
      />
      <ManageProgramsModal
        open={showManagePrograms}
        onClose={() => setShowManagePrograms(false)}
        onSave={handleRefresh}
      />
      <ImportCsvModal
        open={showImportCsv}
        onClose={() => setShowImportCsv(false)}
        onSave={handleRefresh}
      />
    </div>
  );
}
