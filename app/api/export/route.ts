import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

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

export async function GET() {
  const tasks = await prisma.task.findMany({
    select: {
      taskCode: true,
      name: true,
      assignee: true,
      priority: true,
      description: true,
      dependencies: true,
      notes: true,
      status: true,
      targetQuarter: true,
      deliverable: true,
      attachments: true,
      archived: true,
      project: {
        select: {
          name: true,
          reference: true,
          owner: true,
          targetQuarter: true,
          program: {
            select: {
              name: true,
              framework: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const rows = tasks.map((t) => [
    t.project.program.framework.name,
    t.project.program.name,
    t.project.name,
    t.project.reference ?? "",
    t.project.owner ?? "",
    t.project.targetQuarter,
    t.taskCode,
    t.name,
    t.assignee ?? "",
    t.priority,
    t.description ?? "",
    t.dependencies ?? "",
    t.notes ?? "",
    t.status,
    t.targetQuarter,
    t.deliverable ?? "",
    Array.isArray(t.attachments)
      ? t.attachments.map((a: { url: string; title?: string | null }) => a.url).join(", ")
      : "",
    t.archived ? "TRUE" : "FALSE",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([EXCEL_COLUMNS, ...rows]);

  ws["!cols"] = EXCEL_COLUMNS.map((c) => ({
    wch: Math.max(c.length + 2, 16),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="ppp_tracker_export.xlsx"',
    },
  });
}
