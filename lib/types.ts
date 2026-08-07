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

export interface ProjectWithTasks {
  id: number;
  name: string;
  programId: number;
  reference: string | null;
  owner: string | null;
  targetQuarter: string;
  adjustedTargetQuarter: string;
  actualCompletionDate: string | null;
  tasks: Task[];
}

export interface Task {
  id: number;
  taskCode: string;
  projectId: number;
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
  attachmentUrl: string | null;
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
