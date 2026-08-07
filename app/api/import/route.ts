import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";

const EXCEL_COLUMNS = [
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

export async function GET() {
  const sampleRows = [
    [
      "Infrastructure",
      "Network Upgrade",
      "Core Router Replacement",
      "REF-001",
      "John Doe",
      "Q3 2026",
      "T-001",
      "Procure new routers",
      "Jane Smith",
      "High",
      "Replace all core routers",
      "None",
      "Budget approved",
      "In Progress, Partial",
      "Q3 2026",
      "Routers deployed",
      "",
    ],
    [
      "Infrastructure",
      "Network Upgrade",
      "Core Router Replacement",
      "REF-001",
      "John Doe",
      "Q3 2026",
      "T-002",
      "Configure VLANs",
      "Jane Smith",
      "Moderate",
      "Set up VLAN configuration",
      "T-001",
      "",
      "Not Yet Started",
      "Q4 2026",
      "VLAN config complete",
      "",
    ],
    [
      "Security",
      "Access Control",
      "Badge System Upgrade",
      "",
      "Alice Lee",
      "Q4 2026",
      "T-003",
      "Install badge readers",
      "Bob Chen",
      "High",
      "Install readers at all entry points",
      "None",
      "Vendor confirmed delivery",
      "In Progress, Planning or Initiated",
      "Q4 2026",
      "All readers installed",
      "",
    ],
  ];

  const headerRow = EXCEL_COLUMNS.map((c) =>
    c
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...sampleRows]);

  ws["!cols"] = EXCEL_COLUMNS.map((c) => ({
    wch: Math.max(c.length + 2, 16),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import Template");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="ppp_tracker_import_template.xlsx"',
    },
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let records: Record<string, string>[];
  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "Excel file contains no sheets" },
        { status: 400 }
      );
    }
    const sheet = workbook.Sheets[sheetName];
    records = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
      raw: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Excel file" },
      { status: 400 }
    );
  }

  if (records.length === 0) {
    return NextResponse.json(
      { error: "Excel file contains no data rows" },
      { status: 400 }
    );
  }

  const headers = Object.keys(records[0]);
  const actualSet = new Set(headers.map((h) => h.toLowerCase().trim()));
  const missing = EXCEL_COLUMNS.filter(
    (c) => !actualSet.has(c.toLowerCase())
  );
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing columns: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Normalize keys to snake_case for consistent access
  const normalizedRecords = records.map((row) => {
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      const normalized = key.toLowerCase().trim().replace(/\s+/g, "_");
      out[normalized] = String(val ?? "").trim();
    }
    return out;
  });

  let frameworksCreated = 0;
  let programsCreated = 0;
  let projectsCreated = 0;
  let tasksCreated = 0;
  let tasksSkipped = 0;
  let rowsSkipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < normalizedRecords.length; i++) {
    const row = normalizedRecords[i];
    const rowNum = i + 2;
    const frameworkName = row.framework_name || "";
    const programName = row.program_name || "";
    const projectName = row.project_name || "";
    const taskCode = row.task_code || "";
    const taskName = row.task_name || "";
    const taskStatus = row.task_status || "";
    const taskPriority = row.task_priority || "";
    const projectTargetQuarter = row.project_target_quarter || "";
    const taskTargetQuarter = row.task_target_quarter || "";

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
          reference: row.project_reference || null,
          owner: row.project_owner || null,
          targetQuarter: projectTargetQuarter || "Q1 2026",
          adjustedTargetQuarter: projectTargetQuarter || "Q1 2026",
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      projectsCreated++;
    }

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
        assignee: row.task_assignee || null,
        priority: taskPriority || "Low",
        sortOrder: (maxTaskOrder._max.sortOrder ?? -1) + 1,
        description: row.task_description || null,
        dependencies: row.task_dependencies || null,
        notes: row.task_notes || null,
        status: taskStatus,
        targetQuarter: taskTargetQuarter || "Q1 2026",
        adjustedTargetQuarter: taskTargetQuarter || "Q1 2026",
        deliverable: row.task_deliverable || null,
        attachmentUrl: row.task_attachment_url || null,
      },
    });
    tasksCreated++;
  }

  if (frameworksCreated > 0 || programsCreated > 0 || projectsCreated > 0 || tasksCreated > 0) {
    await touchLastModified();
    await logChange({
      entityType: "Import",
      entityId: 0,
      entityName: "Excel Import",
      changeType: "import",
      newValue: `${tasksCreated} tasks, ${projectsCreated} projects, ${programsCreated} programs, ${frameworksCreated} frameworks`,
      details: `Tasks skipped: ${tasksSkipped}, Rows skipped: ${rowsSkipped}`,
    });
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
