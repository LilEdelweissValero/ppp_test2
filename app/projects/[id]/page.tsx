import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import ProjectDetailView from "@/components/ProjectDetailView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id: parseInt(id) },
    include: {
      program: true,
      tasks: { orderBy: { taskCode: "asc" } },
    },
  });

  if (!project) {
    notFound();
  }

  return <ProjectDetailView project={project} />;
}
