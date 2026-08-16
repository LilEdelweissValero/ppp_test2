import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const TASK_COLUMNS = [
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

export async function GET() {
  const [tasks, specialTasks] = await Promise.all([
    prisma.task.findMany({
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
    }),
    prisma.specialTask.findMany({
      select: {
        specialTaskCode: true,
        name: true,
        total: true,
        nys: true,
        plan: true,
        part: true,
        mostly: true,
        done: true,
        dueQuarter: true,
        lastUpdatedDate: true,
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
    }),
  ]);

  const taskRows = tasks.map((t) => [
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
      ? (t.attachments as { url: string; title?: string | null }[]).map((a) => a.url).join(", ")
      : "",
    t.archived ? "TRUE" : "FALSE",
  ]);

  const specialTaskRows = specialTasks.map((st) => [
    st.project.program.framework.name,
    st.project.program.name,
    st.project.name,
    st.project.reference ?? "",
    st.project.owner ?? "",
    st.project.targetQuarter,
    st.specialTaskCode,
    st.name,
    st.total,
    st.nys,
    st.plan,
    st.part,
    st.mostly,
    st.done,
    st.dueQuarter,
    st.lastUpdatedDate ?? "",
    st.archived ? "TRUE" : "FALSE",
  ]);

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([TASK_COLUMNS, ...taskRows]);
  ws1["!cols"] = TASK_COLUMNS.map((c) => ({ wch: Math.max(c.length + 2, 16) }));
  XLSX.utils.book_append_sheet(wb, ws1, "Export");

  const ws2 = XLSX.utils.aoa_to_sheet([SPECIAL_TASK_COLUMNS, ...specialTaskRows]);
  ws2["!cols"] = SPECIAL_TASK_COLUMNS.map((c) => ({ wch: Math.max(c.length + 2, 16) }));
  XLSX.utils.book_append_sheet(wb, ws2, "Special Tasks");

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
