import { seedCatalogData } from "../drizzle/seed";

async function main() {
  try {
    console.log("🌱 Starting catalog seed...");
    await seedCatalogData();
    console.log("✅ Catalog seed completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
