import { prisma } from "@/lib/db";
import { getLastModifiedAt } from "@/lib/system-metadata";
import DashboardView from "@/components/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const frameworks = await prisma.framework.findMany({
    include: {
      programs: {
        include: {
          projects: {
            include: { tasks: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const dashboardFrameworks = frameworks.map((fw) => {
    const projects = fw.programs.flatMap((prog) =>
      prog.projects.map((proj) => ({
        ...proj,
        programName: prog.name,
      }))
    );
    return {
      id: fw.id,
      name: fw.name,
      color: fw.color,
      projects,
    };
  });

  const lastModifiedAt = await getLastModifiedAt();
  let formattedDate = "Never";
  if (lastModifiedAt) {
    const date = new Date(lastModifiedAt);
    formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) + " at " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="bg-slate-800 text-white px-6 py-4 rounded-t-lg mb-0">
          <h1 className="text-xl font-bold tracking-wide">
            ITSD PROJECT TRACKER
          </h1>
          <p className="text-sm text-slate-300">
            Updated as of {formattedDate}
          </p>
        </div>
        <DashboardView frameworks={dashboardFrameworks} />
      </div>
    </main>
  );
}
