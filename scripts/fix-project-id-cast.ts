import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());

const sql = neon(process.env.DATABASE_URL!);

async function fix() {
  const tables = ["invoices", "kuitansi"];

  for (const table of tables) {
    const [col] = await sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = 'project_id'
    `;

    if (!col) {
      console.log(`${table}.project_id — column not found, skip`);
      continue;
    }

    if (col.data_type === "uuid") {
      console.log(`${table}.project_id — already uuid, skip`);
      continue;
    }

    console.log(`${table}.project_id — type=${col.data_type}, fixing...`);

    const fkName = `${table}_project_id_projects_id_fk`;
    const idxName = table === "invoices" ? "inv_project_idx" : "kwt_project_idx";

    // Drop FK and index first if they exist (identifiers can't be parameterized)
    await sql(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${fkName}"`);
    await sql(`DROP INDEX IF EXISTS "${idxName}"`);

    // Cast to uuid
    await sql(`ALTER TABLE "${table}" ALTER COLUMN project_id TYPE uuid USING project_id::uuid`);

    console.log(`${table}.project_id — cast to uuid OK`);
  }

  console.log("Done. Run drizzle-kit push again.");
}

fix().catch((err) => {
  console.error(err);
  process.exit(1);
});
