import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Cleaning placeholder data (FK-safe order)...");

  const changeLogs = await prisma.entityChangeLog.deleteMany();
  console.log(`  Deleted ${changeLogs.count} EntityChangeLog rows`);

  const tasks = await prisma.task.deleteMany();
  console.log(`  Deleted ${tasks.count} Task rows`);

  const projects = await prisma.project.deleteMany();
  console.log(`  Deleted ${projects.count} Project rows`);

  const programs = await prisma.program.deleteMany();
  console.log(`  Deleted ${programs.count} Program rows`);

  console.log("Cleanup complete. Dashboard should now be empty.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
