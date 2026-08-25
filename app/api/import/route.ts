import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { touchLastModified } from "@/lib/system-metadata";
import { logChange } from "@/lib/audit-log";
import { getSettings } from "@/lib/computation-settings-server";

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
  "task_archived",
];

const SPECIAL_TASK_COLUMNS = [
  "framework_name",
  "program_name",
  "project_name",
  "project_reference",
  "project_owner",
  "project_target_quarter",
  "special_task_code",
  "special_task_name",
  "total",
  "nys",
  "plan",
  "part",
  "mostly",
  "done",
  "due_quarter",
  "last_updated_date",
  "archived",
];

const VALID_PRIORITIES = ["Low", "Moderate", "High"];

function parseQuarter(q: string): boolean {
  return /^Q[1-4]\s+\d{4}$/.test(q.trim());
}

export async function GET() {
  const sampleTaskRows = [
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
      "FALSE",
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
      "FALSE",
    ],
  ];

  const sampleSpecialTaskRows = [
    [
      "Infrastructure",
      "Network Upgrade",
      "Core Router Replacement",
      "REF-001",
      "John Doe",
      "Q3 2026",
      "SPEC-001",
      "Server Migration",
      10,
      2,
      3,
      1,
      2,
      2,
      "Q3 2026",
      "",
      "FALSE",
    ],
  ];

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([EXCEL_COLUMNS, ...sampleTaskRows]);
  ws1["!cols"] = EXCEL_COLUMNS.map((c) => ({ wch: Math.max(c.length + 2, 16) }));
  XLSX.utils.book_append_sheet(wb, ws1, "Export");

  const ws2 = XLSX.utils.aoa_to_sheet([SPECIAL_TASK_COLUMNS, ...sampleSpecialTaskRows]);
  ws2["!cols"] = SPECIAL_TASK_COLUMNS.map((c) => ({ wch: Math.max(c.length + 2, 16) }));
  XLSX.utils.book_append_sheet(wb, ws2, "Special Tasks");

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
  const settings = await getSettings();
  const validStatuses = settings.statuses.map((s) => s.name);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array" });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Excel file" },
      { status: 400 }
    );
  }

  if (workbook.SheetNames.length === 0) {
    return NextResponse.json(
      { error: "Excel file contains no sheets" },
      { status: 400 }
    );
  }

  let frameworksCreated = 0;
  let programsCreated = 0;
  let projectsCreated = 0;
  let tasksCreated = 0;
  let specialTasksCreated = 0;
  let tasksSkipped = 0;
  let specialTasksSkipped = 0;
  let rowsSkipped = 0;
  const errors: string[] = [];

  // Helper to find or create framework/program/project
  async function findOrCreateProject(
    frameworkName: string,
    programName: string,
    projectName: string,
    projectRef: string | null,
    projectOwner: string | null,
    projectTargetQuarter: string
  ) {
    let framework = await prisma.framework.findFirst({
      where: { name: frameworkName },
    });
    if (!framework) {
      const maxOrder = await prisma.framework.aggregate({ _max: { sortOrder: true } });
      framework = await prisma.framework.create({
        data: { name: frameworkName, color: "#E5E7EB", sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
      });
      frameworksCreated++;
      await logChange({
        entityType: "Framework",
        entityId: framework.id,
        entityName: framework.name,
        changeType: "create",
      });
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
      await logChange({
        entityType: "Program",
        entityId: program.id,
        entityName: program.name,
        changeType: "create",
      });
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
          reference: projectRef || null,
          owner: projectOwner || null,
          targetQuarter: projectTargetQuarter || "Q1 2026",
          adjustedTargetQuarter: projectTargetQuarter || "Q1 2026",
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      projectsCreated++;
      await logChange({
        entityType: "Project",
        entityId: project.id,
        entityName: project.name,
        changeType: "create",
      });
    }

    return project;
  }

  // Process normal tasks sheet (first sheet or named "Export")
  const taskSheetName = workbook.SheetNames.find((n) => n === "Export") || workbook.SheetNames[0];
  if (taskSheetName) {
    const sheet = workbook.Sheets[taskSheetName];
    const records: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    if (records.length > 0) {
      const headers = Object.keys(records[0]);
      const actualSet = new Set(headers.map((h) => h.toLowerCase().trim()));
      const missing = EXCEL_COLUMNS.filter(
        (c) => !actualSet.has(c.toLowerCase())
      );
      if (missing.length > 0) {
        errors.push(`Sheet "${taskSheetName}": Missing columns: ${missing.join(", ")}`);
      } else {
        const normalizedRecords = records.map((row) => {
          const out: Record<string, string> = {};
          for (const [key, val] of Object.entries(row)) {
            const normalized = key.toLowerCase().trim().replace(/\s+/g, "_");
            out[normalized] = String(val ?? "").trim();
          }
          return out;
        });

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
          const taskArchived = row.task_archived?.toUpperCase() === "TRUE";

          if (!frameworkName || !projectName || !taskCode || !taskName) {
            rowsSkipped++;
            errors.push(
              `Row ${rowNum}: missing required fields (framework_name, project_name, task_code, or task_name)`
            );
            continue;
          }
          if (!taskStatus || !validStatuses.includes(taskStatus)) {
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

          const project = await findOrCreateProject(
            frameworkName,
            programName,
            projectName,
            row.project_reference || null,
            row.project_owner || null,
            projectTargetQuarter
          );

          const existingTask = await prisma.task.findFirst({
            where: { taskCode },
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
              attachments: (() => {
                const raw = row.task_attachment_url || "";
                if (!raw) return undefined;
                if (raw.trimStart().startsWith("[")) {
                  try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                  } catch {}
                }
                return raw.split(",").map((u: string) => ({ url: u.trim(), title: null })).filter((a: { url: string; title: null }) => a.url);
              })(),
              archived: taskArchived,
            },
          });
          tasksCreated++;
          await logChange({
            entityType: "Task",
            entityId: (await prisma.task.findFirst({ where: { taskCode }, select: { id: true, name: true } }))?.id ?? 0,
            entityName: `${taskCode}: ${taskName}`,
            changeType: "create",
          });
        }
      }
    }
  }

  // Process special tasks sheet if it exists
  const specialSheetName = workbook.SheetNames.find((n) => n === "Special Tasks");
  if (specialSheetName) {
    const sheet = workbook.Sheets[specialSheetName];
    const records: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    if (records.length > 0) {
      const headers = Object.keys(records[0]);
      const actualSet = new Set(headers.map((h) => h.toLowerCase().trim()));
      const missing = SPECIAL_TASK_COLUMNS.filter(
        (c) => !actualSet.has(c.toLowerCase())
      );
      if (missing.length > 0) {
        errors.push(`Sheet "${specialSheetName}": Missing columns: ${missing.join(", ")}`);
      } else {
        const normalizedRecords = records.map((row) => {
          const out: Record<string, string> = {};
          for (const [key, val] of Object.entries(row)) {
            const normalized = key.toLowerCase().trim().replace(/\s+/g, "_");
            out[normalized] = String(val ?? "").trim();
          }
          return out;
        });

        for (let i = 0; i < normalizedRecords.length; i++) {
          const row = normalizedRecords[i];
          const rowNum = i + 2;
          const frameworkName = row.framework_name || "";
          const programName = row.program_name || "";
          const projectName = row.project_name || "";
          const specialTaskCode = row.special_task_code || "";
          const specialTaskName = row.special_task_name || "";
          const dueQuarter = row.due_quarter || "";
          const projectTargetQuarter = row.project_target_quarter || "";
          const specialTaskArchived = row.archived?.toUpperCase() === "TRUE";

          if (!frameworkName || !projectName || !specialTaskCode || !specialTaskName) {
            rowsSkipped++;
            errors.push(
              `Row ${rowNum} (Special Tasks): missing required fields (framework_name, project_name, special_task_code, or special_task_name)`
            );
            continue;
          }
          if (!dueQuarter || !parseQuarter(dueQuarter)) {
            rowsSkipped++;
            errors.push(
              `Row ${rowNum} (Special Tasks): invalid due_quarter "${dueQuarter}"`
            );
            continue;
          }
          if (projectTargetQuarter && !parseQuarter(projectTargetQuarter)) {
            rowsSkipped++;
            errors.push(
              `Row ${rowNum} (Special Tasks): invalid project_target_quarter "${projectTargetQuarter}"`
            );
            continue;
          }

          const project = await findOrCreateProject(
            frameworkName,
            programName,
            projectName,
            row.project_reference || null,
            row.project_owner || null,
            projectTargetQuarter
          );

          const existingSpecialTask = await prisma.specialTask.findFirst({
            where: { specialTaskCode },
          });
          if (existingSpecialTask) {
            specialTasksSkipped++;
            continue;
          }

          const maxOrder = await prisma.specialTask.aggregate({ _max: { sortOrder: true }, where: { projectId: project.id } });
          await prisma.specialTask.create({
            data: {
              specialTaskCode,
              projectId: project.id,
              name: specialTaskName,
              sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
              total: parseInt(row.total) || 0,
              nys: parseInt(row.nys) || 0,
              plan: parseInt(row.plan) || 0,
              part: parseInt(row.part) || 0,
              mostly: parseInt(row.mostly) || 0,
              done: parseInt(row.done) || 0,
              dueQuarter,
              lastUpdatedDate: row.last_updated_date || null,
              archived: specialTaskArchived,
            },
          });
          specialTasksCreated++;
          await logChange({
            entityType: "SpecialTask",
            entityId: (await prisma.specialTask.findFirst({ where: { specialTaskCode }, select: { id: true } }))?.id ?? 0,
            entityName: `${specialTaskCode}: ${specialTaskName}`,
            changeType: "create",
          });
        }
      }
    }
  }

  const totalCreated = tasksCreated + specialTasksCreated;
  if (frameworksCreated > 0 || programsCreated > 0 || projectsCreated > 0 || totalCreated > 0) {
    await touchLastModified();
    await logChange({
      entityType: "Import",
      entityId: 0,
      entityName: "Excel Import",
      changeType: "import",
      newValue: `${tasksCreated} tasks, ${specialTasksCreated} special tasks, ${projectsCreated} projects, ${programsCreated} programs, ${frameworksCreated} frameworks`,
      details: `Tasks skipped: ${tasksSkipped}, Special tasks skipped: ${specialTasksSkipped}, Rows skipped: ${rowsSkipped}`,
    });
  }

  return NextResponse.json({
    frameworksCreated,
    programsCreated,
    projectsCreated,
    tasksCreated,
    specialTasksCreated,
    tasksSkipped,
    specialTasksSkipped,
    rowsSkipped,
    errors,
  });
}
