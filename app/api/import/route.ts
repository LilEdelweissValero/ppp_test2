import { NextRequest } from "next/server";
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

function normalizeRow(row: Record<string, string | unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    out[key.toLowerCase().trim().replace(/\s+/g, "_")] = String(val ?? "").trim();
  }
  return out;
}

// ── GET: template download ──────────────────────────────────────────────────

export async function GET() {
  const sampleTaskRows = [
    [
      "Infrastructure", "Network Upgrade", "Core Router Replacement",
      "REF-001", "John Doe", "Q3 2026", "T-001", "Procure new routers",
      "Jane Smith", "High", "Replace all core routers", "None",
      "Budget approved", "In Progress, Partial", "Q3 2026", "Routers deployed", "", "FALSE",
    ],
    [
      "Infrastructure", "Network Upgrade", "Core Router Replacement",
      "REF-001", "John Doe", "Q3 2026", "T-002", "Configure VLANs",
      "Jane Smith", "Moderate", "Set up VLAN configuration", "T-001",
      "", "Not Yet Started", "Q4 2026", "VLAN config complete", "", "FALSE",
    ],
  ];

  const sampleSpecialTaskRows = [
    [
      "Infrastructure", "Network Upgrade", "Core Router Replacement",
      "REF-001", "John Doe", "Q3 2026", "SPEC-001", "Server Migration",
      10, 2, 3, 1, 2, 2, "Q3 2026", "", "FALSE",
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
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ppp_tracker_import_template.xlsx"',
    },
  });
}

// ── POST: import (NDJSON streaming) ─────────────────────────────────────────

interface Problem {
  row: string;
  sheet: string;
  reason: string;
}

interface ValidatedTaskRow {
  frameworkName: string;
  programName: string;
  projectName: string;
  projectRef: string | null;
  projectOwner: string | null;
  projectTargetQuarter: string;
  taskCode: string;
  taskName: string;
  taskStatus: string;
  taskPriority: string;
  taskTargetQuarter: string;
  taskArchived: boolean;
  row: Record<string, string>;
  rowNum: number;
}

interface ValidatedSpecialTaskRow {
  frameworkName: string;
  programName: string;
  projectName: string;
  projectRef: string | null;
  projectOwner: string | null;
  projectTargetQuarter: string;
  specialTaskCode: string;
  specialTaskName: string;
  dueQuarter: string;
  row: Record<string, string>;
  rowNum: number;
  archived: boolean;
}

export async function POST(request: NextRequest) {
  const settings = await getSettings();
  const validStatuses = settings.statuses.map((s) => s.name);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const dryRun = formData.get("dryRun") === "true";

  if (!file) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  let workbook: XLSX.WorkBook;
  try {
    const arrayBuffer = await file.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: "array" });
  } catch {
    return Response.json({ error: "Failed to parse Excel file" }, { status: 400 });
  }

  if (workbook.SheetNames.length === 0) {
    return Response.json({ error: "Excel file contains no sheets" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        // ── Phase 1: Parse & validate all rows ────────────────────────────
        const problems: Problem[] = [];
        const validTaskRows: ValidatedTaskRow[] = [];
        const validSpecialTaskRows: ValidatedSpecialTaskRow[] = [];

        // Track intra-file duplicates
        const seenTaskCodes = new Set<string>();
        const seenSpecialTaskCodes = new Set<string>();
        // Track entities that would be created
        const seenFrameworks = new Set<string>();
        const seenPrograms = new Set<string>();
        const seenProjects = new Set<string>(); // key: "programId:name"

        // Check DB for existing frameworks/programs/projects
        const existingFrameworkNames = new Set(
          (await prisma.framework.findMany({ select: { name: true } })).map((f) => f.name)
        );
        const existingProgramNames = new Set(
          (await prisma.program.findMany({ select: { name: true } })).map((p) => p.name)
        );
        const existingProjectKeys = new Set(
          (await prisma.project.findMany({ select: { name: true, programId: true } })).map(
            (p) => `${p.programId}:${p.name}`
          )
        );
        const existingTaskCodes = new Set(
          (await prisma.task.findMany({ select: { taskCode: true } })).map((t) => t.taskCode)
        );
        const existingSpecialTaskCodes = new Set(
          (await prisma.specialTask.findMany({ select: { specialTaskCode: true } })).map((s) => s.specialTaskCode)
        );

        let totalRows = 0;
        let processedValidation = 0;

        // Parse task sheet
        const taskSheetName = workbook.SheetNames.find((n) => n === "Export") || workbook.SheetNames[0];
        const taskRecords: Record<string, string>[] = [];
        if (taskSheetName) {
          const sheet = workbook.Sheets[taskSheetName];
          const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
            defval: "",
            raw: false,
          });
          if (raw.length > 0) {
            const headers = Object.keys(raw[0]);
            const actualSet = new Set(headers.map((h) => h.toLowerCase().trim()));
            const missing = EXCEL_COLUMNS.filter((c) => !actualSet.has(c.toLowerCase()));
            if (missing.length > 0) {
              problems.push({
                row: "Sheet",
                sheet: taskSheetName,
                reason: `Missing columns: ${missing.join(", ")}`,
              });
            } else {
              taskRecords.push(...raw.map((r) => normalizeRow(r)));
            }
          }
        }

        // Parse special tasks sheet
        const specialSheetName = workbook.SheetNames.find((n) => n === "Special Tasks");
        const specialTaskRecords: Record<string, string>[] = [];
        if (specialSheetName) {
          const sheet = workbook.Sheets[specialSheetName];
          const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
            defval: "",
            raw: false,
          });
          if (raw.length > 0) {
            const headers = Object.keys(raw[0]);
            const actualSet = new Set(headers.map((h) => h.toLowerCase().trim()));
            const missing = SPECIAL_TASK_COLUMNS.filter((c) => !actualSet.has(c.toLowerCase()));
            if (missing.length > 0) {
              problems.push({
                row: "Sheet",
                sheet: specialSheetName,
                reason: `Missing columns: ${missing.join(", ")}`,
              });
            } else {
              specialTaskRecords.push(...raw.map((r) => normalizeRow(r)));
            }
          }
        }

        totalRows = taskRecords.length + specialTaskRecords.length;

        // Validate task rows
        for (let i = 0; i < taskRecords.length; i++) {
          const row = taskRecords[i];
          const rowNum = i + 2;
          const sheetLabel = taskSheetName || "Export";

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
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: "Missing required fields (framework_name, project_name, task_code, or task_name)" });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }
          if (!taskStatus || !validStatuses.includes(taskStatus)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Invalid task_status "${taskStatus}"` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }
          if (taskPriority && !VALID_PRIORITIES.includes(taskPriority)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Invalid task_priority "${taskPriority}"` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }
          if (taskTargetQuarter && !parseQuarter(taskTargetQuarter)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Invalid task_target_quarter "${taskTargetQuarter}"` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }
          if (projectTargetQuarter && !parseQuarter(projectTargetQuarter)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Invalid project_target_quarter "${projectTargetQuarter}"` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }

          // DB duplicate check
          if (existingTaskCodes.has(taskCode)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Duplicate task_code "${taskCode}" (already exists)` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }

          // Intra-file duplicate check
          if (seenTaskCodes.has(taskCode)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Duplicate task_code "${taskCode}" (duplicate in file)` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }

          seenTaskCodes.add(taskCode);

          // Track entities that would be created
          if (!existingFrameworkNames.has(frameworkName) && !seenFrameworks.has(frameworkName)) {
            seenFrameworks.add(frameworkName);
          }
          if (!existingProgramNames.has(programName) && !seenPrograms.has(programName)) {
            seenPrograms.add(programName);
          }
          const projKey = `${programName}:${projectName}`;
          if (!seenProjects.has(projKey) && !existingProjectKeys.has(projKey)) {
            seenProjects.add(projKey);
          }

          validTaskRows.push({
            frameworkName, programName, projectName,
            projectRef: row.project_reference || null,
            projectOwner: row.project_owner || null,
            projectTargetQuarter,
            taskCode, taskName, taskStatus, taskPriority, taskTargetQuarter,
            taskArchived, row, rowNum,
          });

          processedValidation++;
          if (processedValidation % 5 === 0 || processedValidation === totalRows) {
            enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
          }
        }

        // Validate special task rows
        for (let i = 0; i < specialTaskRecords.length; i++) {
          const row = specialTaskRecords[i];
          const rowNum = i + 2;
          const sheetLabel = specialSheetName || "Special Tasks";

          const frameworkName = row.framework_name || "";
          const programName = row.program_name || "";
          const projectName = row.project_name || "";
          const specialTaskCode = row.special_task_code || "";
          const specialTaskName = row.special_task_name || "";
          const dueQuarter = row.due_quarter || "";
          const projectTargetQuarter = row.project_target_quarter || "";
          const specialTaskArchived = row.archived?.toUpperCase() === "TRUE";

          if (!frameworkName || !projectName || !specialTaskCode || !specialTaskName) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: "Missing required fields (framework_name, project_name, special_task_code, or special_task_name)" });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }
          if (!dueQuarter || !parseQuarter(dueQuarter)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Invalid due_quarter "${dueQuarter}"` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }
          if (projectTargetQuarter && !parseQuarter(projectTargetQuarter)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Invalid project_target_quarter "${projectTargetQuarter}"` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }

          // DB duplicate check
          if (existingSpecialTaskCodes.has(specialTaskCode)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Duplicate special_task_code "${specialTaskCode}" (already exists)` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }

          // Intra-file duplicate check
          if (seenSpecialTaskCodes.has(specialTaskCode)) {
            problems.push({ row: `Row ${rowNum}`, sheet: sheetLabel, reason: `Duplicate special_task_code "${specialTaskCode}" (duplicate in file)` });
            processedValidation++;
            if (processedValidation % 5 === 0 || processedValidation === totalRows) {
              enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
            }
            continue;
          }

          seenSpecialTaskCodes.add(specialTaskCode);

          // Track entities that would be created
          if (!existingFrameworkNames.has(frameworkName) && !seenFrameworks.has(frameworkName)) {
            seenFrameworks.add(frameworkName);
          }
          if (!existingProgramNames.has(programName) && !seenPrograms.has(programName)) {
            seenPrograms.add(programName);
          }
          const projKey = `${programName}:${projectName}`;
          if (!seenProjects.has(projKey) && !existingProjectKeys.has(projKey)) {
            seenProjects.add(projKey);
          }

          validSpecialTaskRows.push({
            frameworkName, programName, projectName,
            projectRef: row.project_reference || null,
            projectOwner: row.project_owner || null,
            projectTargetQuarter,
            specialTaskCode, specialTaskName, dueQuarter,
            row, rowNum, archived: specialTaskArchived,
          });

          processedValidation++;
          if (processedValidation % 5 === 0 || processedValidation === totalRows) {
            enqueue({ type: "progress", phase: "reading", processed: processedValidation, total: totalRows });
          }
        }

        // ── Emit preview ──────────────────────────────────────────────────
        if (dryRun) {
          enqueue({
            type: "preview",
            frameworks: seenFrameworks.size,
            programs: seenPrograms.size,
            projects: seenProjects.size,
            tasks: validTaskRows.length,
            specialTasks: validSpecialTaskRows.length,
            hasTaskSheet: taskRecords.length > 0,
            hasSpecialTasksSheet: specialTaskRecords.length > 0,
            problems,
            totalRows,
          });
          controller.close();
          return;
        }

        // ── Phase 2: Create entities ──────────────────────────────────────
        let frameworksCreated = 0;
        let programsCreated = 0;
        let projectsCreated = 0;
        let tasksCreated = 0;
        let specialTasksCreated = 0;
        let processedCreate = 0;
        const totalToCreate = validTaskRows.length + validSpecialTaskRows.length;
        const createdFrameworkNames = new Set<string>();
        const createdProgramNames = new Set<string>();
        const createdProjectKeys = new Set<string>();

        // Restore creation tracking sets from validation phase
        for (const name of seenFrameworks) createdFrameworkNames.add(name);
        for (const name of seenPrograms) createdProgramNames.add(name);
        for (const key of seenProjects) createdProjectKeys.add(key);

        async function findOrCreateProjectForImport(
          frameworkName: string,
          programName: string,
          projectName: string,
          projectRef: string | null,
          projectOwner: string | null,
          projectTargetQuarter: string
        ) {
          let framework = await prisma.framework.findFirst({ where: { name: frameworkName } });
          if (!framework) {
            const maxOrder = await prisma.framework.aggregate({ _max: { sortOrder: true } });
            framework = await prisma.framework.create({
              data: { name: frameworkName, color: "#E5E7EB", sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
            });
            frameworksCreated++;
            await logChange({ entityType: "Framework", entityId: framework.id, entityName: framework.name, changeType: "create" });
          }

          let program = await prisma.program.findFirst({ where: { name: programName } });
          if (!program) {
            const maxOrder = await prisma.program.aggregate({ _max: { sortOrder: true }, where: { frameworkId: framework.id } });
            program = await prisma.program.create({
              data: { name: programName, frameworkId: framework.id, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
            });
            programsCreated++;
            await logChange({ entityType: "Program", entityId: program.id, entityName: program.name, changeType: "create" });
          }

          let project = await prisma.project.findFirst({ where: { name: projectName, programId: program.id } });
          if (!project) {
            const maxOrder = await prisma.project.aggregate({ _max: { sortOrder: true }, where: { programId: program.id } });
            project = await prisma.project.create({
              data: {
                name: projectName, programId: program.id,
                reference: projectRef || null, owner: projectOwner || null,
                targetQuarter: projectTargetQuarter || "Q1 2026",
                adjustedTargetQuarter: projectTargetQuarter || "Q1 2026",
                sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
              },
            });
            projectsCreated++;
            await logChange({ entityType: "Project", entityId: project.id, entityName: project.name, changeType: "create" });
          }
          return project;
        }

        // Create tasks
        for (const v of validTaskRows) {
          const project = await findOrCreateProjectForImport(
            v.frameworkName, v.programName, v.projectName,
            v.projectRef, v.projectOwner, v.projectTargetQuarter,
          );

          const maxTaskOrder = await prisma.task.aggregate({ _max: { sortOrder: true }, where: { projectId: project.id } });
          const created = await prisma.task.create({
            data: {
              taskCode: v.taskCode, projectId: project.id, name: v.taskName,
              assignee: v.row.task_assignee || null,
              priority: v.taskPriority || "Low",
              sortOrder: (maxTaskOrder._max.sortOrder ?? -1) + 1,
              description: v.row.task_description || null,
              dependencies: v.row.task_dependencies || null,
              notes: v.row.task_notes || null,
              status: v.taskStatus,
              targetQuarter: v.taskTargetQuarter || "Q1 2026",
              adjustedTargetQuarter: v.taskTargetQuarter || "Q1 2026",
              deliverable: v.row.task_deliverable || null,
              attachments: (() => {
                const raw = v.row.task_attachment_url || "";
                if (!raw) return undefined;
                if (raw.trimStart().startsWith("[")) {
                  try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                  } catch {}
                }
                return raw.split(",").map((u: string) => ({ url: u.trim(), title: null })).filter((a: { url: string; title: null }) => a.url);
              })(),
              archived: v.taskArchived,
            },
          });
          tasksCreated++;
          await logChange({ entityType: "Task", entityId: created.id, entityName: `${v.taskCode}: ${v.taskName}`, changeType: "create" });

          processedCreate++;
          if (processedCreate % 3 === 0 || processedCreate === totalToCreate) {
            enqueue({ type: "progress", phase: "importing", processed: processedCreate, total: totalToCreate });
          }
        }

        // Create special tasks
        for (const v of validSpecialTaskRows) {
          const project = await findOrCreateProjectForImport(
            v.frameworkName, v.programName, v.projectName,
            v.projectRef, v.projectOwner, v.projectTargetQuarter,
          );

          const maxOrder = await prisma.specialTask.aggregate({ _max: { sortOrder: true }, where: { projectId: project.id } });
          const created = await prisma.specialTask.create({
            data: {
              specialTaskCode: v.specialTaskCode, projectId: project.id, name: v.specialTaskName,
              sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
              total: parseInt(v.row.total) || 0,
              nys: parseInt(v.row.nys) || 0,
              plan: parseInt(v.row.plan) || 0,
              part: parseInt(v.row.part) || 0,
              mostly: parseInt(v.row.mostly) || 0,
              done: parseInt(v.row.done) || 0,
              dueQuarter: v.dueQuarter,
              lastUpdatedDate: v.row.last_updated_date || null,
              archived: v.archived,
            },
          });
          specialTasksCreated++;
          await logChange({ entityType: "SpecialTask", entityId: created.id, entityName: `${v.specialTaskCode}: ${v.specialTaskName}`, changeType: "create" });

          processedCreate++;
          if (processedCreate % 3 === 0 || processedCreate === totalToCreate) {
            enqueue({ type: "progress", phase: "importing", processed: processedCreate, total: totalToCreate });
          }
        }

        // Touch last modified + summary log
        const totalCreated = tasksCreated + specialTasksCreated;
        if (frameworksCreated > 0 || programsCreated > 0 || projectsCreated > 0 || totalCreated > 0) {
          await touchLastModified();
          await logChange({
            entityType: "Import",
            entityId: 0,
            entityName: "Excel Import",
            changeType: "import",
            newValue: `${tasksCreated} tasks, ${specialTasksCreated} special tasks, ${projectsCreated} projects, ${programsCreated} programs, ${frameworksCreated} frameworks`,
            details: `Tasks skipped: ${validTaskRows.length > 0 ? 0 : 0}, Problems: ${problems.length}`,
          });
        }

        enqueue({
          type: "result",
          frameworksCreated,
          programsCreated,
          projectsCreated,
          tasksCreated,
          specialTasksCreated,
          tasksSkipped: problems.filter((p) => p.reason.includes("task_code") && p.reason.includes("already exists")).length,
          specialTasksSkipped: problems.filter((p) => p.reason.includes("special_task_code") && p.reason.includes("already exists")).length,
          rowsSkipped: problems.length,
          errors: problems.map((p) => `${p.row} (${p.sheet}): ${p.reason}`),
        });

        controller.close();
      } catch (err) {
        enqueue({ type: "error", error: err instanceof Error ? err.message : "Import failed" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
