import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parse } from "csv-parse/sync";
import { touchLastModified } from "@/lib/system-metadata";

const CSV_COLUMNS = [
  "framework_name",
  "program_name",
  "project_name",
  "project_reference",
  "project_owner",
  "project_target_quarter",
  "task_code",
  "task_name",
  "task_assignee",
  "task_priority",
  "task_description",
  "task_dependencies",
  "task_notes",
  "task_status",
  "task_target_quarter",
  "task_deliverable",
  "task_attachment_url",
];

const VALID_STATUSES = [
  "Not Yet Started",
  "In Progress, Planning or Initiated",
  "In Progress, Partial",
  "In Progress, Mostly Done or Testing",
  "Complete or Verified",
];

const VALID_PRIORITIES = ["Low", "Moderate", "High"];

function parseQuarter(q: string): boolean {
  return /^Q[1-4]\s+\d{4}$/.test(q.trim());
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch {
    return NextResponse.json({ error: "Failed to parse CSV" }, { status: 400 });
  }

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const actualSet = new Set(headers);
  const missing = CSV_COLUMNS.filter((c) => !actualSet.has(c));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing CSV columns: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  let frameworksCreated = 0;
  let programsCreated = 0;
  let projectsCreated = 0;
  let tasksCreated = 0;
  let tasksSkipped = 0;
  let rowsSkipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;
    const frameworkName = row.framework_name?.trim() || "";
    const programName = row.program_name?.trim() || "";
    const projectName = row.project_name?.trim() || "";
    const taskCode = row.task_code?.trim() || "";
    const taskName = row.task_name?.trim() || "";
    const taskStatus = row.task_status?.trim() || "";
    const taskPriority = row.task_priority?.trim() || "";
    const projectTargetQuarter = row.project_target_quarter?.trim() || "";
    const taskTargetQuarter = row.task_target_quarter?.trim() || "";

    if (!frameworkName || !projectName || !taskCode || !taskName) {
      rowsSkipped++;
      errors.push(
        `Row ${rowNum}: missing required fields (framework_name, project_name, task_code, or task_name)`
      );
      continue;
    }
    if (!taskStatus || !VALID_STATUSES.includes(taskStatus)) {
      rowsSkipped++;
      errors.push(
        `Row ${rowNum}: invalid task_status "${taskStatus}"`
      );
      continue;
    }
    if (taskPriority && !VALID_PRIORITIES.includes(taskPriority)) {
      rowsSkipped++;
      errors.push(
        `Row ${rowNum}: invalid task_priority "${taskPriority}"`
      );
      continue;
    }
    if (taskTargetQuarter && !parseQuarter(taskTargetQuarter)) {
      rowsSkipped++;
      errors.push(
        `Row ${rowNum}: invalid task_target_quarter "${taskTargetQuarter}"`
      );
      continue;
    }
    if (projectTargetQuarter && !parseQuarter(projectTargetQuarter)) {
      rowsSkipped++;
      errors.push(
        `Row ${rowNum}: invalid project_target_quarter "${projectTargetQuarter}"`
      );
      continue;
    }

    // Look up or create framework
    let framework = await prisma.framework.findFirst({
      where: { name: frameworkName },
    });
    if (!framework) {
      const maxOrder = await prisma.framework.aggregate({ _max: { sortOrder: true } });
      framework = await prisma.framework.create({
        data: { name: frameworkName, color: "#E5E7EB", sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
      });
      frameworksCreated++;
    }

    // Look up or create program
    let program = await prisma.program.findFirst({
      where: { name: programName },
    });
    if (!program) {
      const maxOrder = await prisma.program.aggregate({
        _max: { sortOrder: true },
        where: { frameworkId: framework.id },
      });
      program = await prisma.program.create({
        data: { name: programName, frameworkId: framework.id, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
      });
      programsCreated++;
    }

    // Look up or create project within program
    let project = await prisma.project.findFirst({
      where: { name: projectName, programId: program.id },
    });
    if (!project) {
      const maxOrder = await prisma.project.aggregate({
        _max: { sortOrder: true },
        where: { programId: program.id },
      });
      project = await prisma.project.create({
        data: {
          name: projectName,
          programId: program.id,
          reference: row.project_reference?.trim() || null,
          owner: row.project_owner?.trim() || null,
          targetQuarter: projectTargetQuarter || "Q1 2026",
          adjustedTargetQuarter: projectTargetQuarter || "Q1 2026",
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      projectsCreated++;
    }

    // Check for duplicate task_code
    const existingTask = await prisma.task.findFirst({
      where: { projectId: project.id, taskCode },
    });
    if (existingTask) {
      tasksSkipped++;
      continue;
    }

    const maxTaskOrder = await prisma.task.aggregate({ _max: { sortOrder: true }, where: { projectId: project.id } });
    await prisma.task.create({
      data: {
        taskCode,
        projectId: project.id,
        name: taskName,
        assignee: row.task_assignee?.trim() || null,
        priority: taskPriority || "Low",
        sortOrder: (maxTaskOrder._max.sortOrder ?? -1) + 1,
        description: row.task_description?.trim() || null,
        dependencies: row.task_dependencies?.trim() || null,
        notes: row.task_notes?.trim() || null,
        status: taskStatus,
        targetQuarter: taskTargetQuarter || "Q1 2026",
        adjustedTargetQuarter: taskTargetQuarter || "Q1 2026",
        deliverable: row.task_deliverable?.trim() || null,
        attachmentUrl: row.task_attachment_url?.trim() || null,
      },
    });
    tasksCreated++;
  }

  if (frameworksCreated > 0 || programsCreated > 0 || projectsCreated > 0 || tasksCreated > 0) {
    await touchLastModified();
  }

  return NextResponse.json({
    frameworksCreated,
    programsCreated,
    projectsCreated,
    tasksCreated,
    tasksSkipped,
    rowsSkipped,
    errors,
  });
}
