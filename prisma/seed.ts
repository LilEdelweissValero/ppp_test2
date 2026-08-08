import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Only seed frameworks — programs, projects, and tasks are managed via the UI
  await prisma.framework.upsert({
    where: { name: "Infrastructure" },
    update: {},
    create: { name: "Infrastructure", color: "#DBEAFE" },
  });

  await prisma.framework.upsert({
    where: { name: "Security" },
    update: {},
    create: { name: "Security", color: "#FEE2E2" },
  });

  await prisma.framework.upsert({
    where: { name: "Digital" },
    update: {},
    create: { name: "Digital", color: "#D1FAE5" },
  });

  console.log("Seed complete!");
  console.log("  Frameworks: 3");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
