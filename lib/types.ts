export interface FrameworkWithPrograms {
  id: number;
  name: string;
  color: string;
  programs: ProgramWithProjects[];
}

export interface ProgramWithProjects {
  id: number;
  name: string;
  frameworkId: number;
  projects: ProjectWithTasks[];
}

export interface Phase {
  id: number;
  name: string;
  projectId: number;
  weight: number;
  sortOrder: number;
  archived: boolean;
}

export interface SpecialTask {
  id: number;
  specialTaskCode: string;
  projectId: number;
  phaseId: number | null;
  name: string;
  sortOrder: number;
  total: number;
  nys: number;
  plan: number;
  part: number;
  mostly: number;
  done: number;
  dueQuarter: string;
  lastUpdatedDate: string | null;
  archived: boolean;
}

export interface ProjectWithTasks {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  actualCompletionDate: string | null;
  phases: Phase[];
  tasks: Task[];
  specialTasks: SpecialTask[];
}

export interface Task {
  id: number;
  taskCode: string;
  projectId: number;
  phaseId: number | null;
  name: string;
  assignee: string | null;
  priority: string;
  description: string | null;
  dependencies: string | null;
  notes: string | null;
  status: string;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  deliverable: string | null;
  attachments: { url: string; title: string | null }[] | null;
}

export interface ProjectForDashboard {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  adjustedTargetQuarter: string;
  percentComplete: number;
  quarterSpecificPercent: number | null;
  health: string;
}

export interface ProgramForDashboard {
  id: number;
  name: string;
  percentComplete: number;
  healthSummary: Record<string, number>;
  projects: ProjectForDashboard[];
}

export interface ChangeLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  oldQuarter: string;
  newQuarter: string;
  remarks: string | null;
}
