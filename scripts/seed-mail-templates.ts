/**
 * Seed script: buat default mail templates & layouts.
 * Jalankan: npx tsx scripts/seed-mail-templates.ts
 */
import { loadEnvConfig } from "@next/env";

// Load .env.local before anything else
loadEnvConfig(process.cwd());

async function main() {
  console.log("🌱 Seeding mail templates & layouts...");

  // Dynamic import AFTER env is loaded
  const { seedMailTemplates } = await import("../src/server/actions/mail-templates/seed");

  try {
    const result = await seedMailTemplates();
    console.log("✅", result.message);
    console.log("   - 3 layouts (Default, Minimal, Formal)");
    console.log("   - 16 system templates");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Error:", message);
    process.exit(1);
  }

  process.exit(0);
}

main();
