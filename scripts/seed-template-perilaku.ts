/**
 * Seed: Template Perilaku Standar (11 item default)
 *
 * Jalankan: npx tsx scripts/seed-template-perilaku.ts
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { penilaianTemplate, penilaianTemplateItem } from "../src/server/db/schema";

const TEMPLATE_NAMA = "Perilaku Standar";

const DEFAULT_ITEMS = [
  { nomor: 1, keterangan: "Loyalitas dan kesungguhan terhadap pekerjaannya", bobot: "0.100" },
  { nomor: 2, keterangan: "Komitmen dan tanggung jawab terhadap tugas", bobot: "0.100" },
  { nomor: 3, keterangan: "Disiplin dan kepatuhan terhadap peraturan kerja", bobot: "0.100" },
  { nomor: 4, keterangan: "Sikap profesional dalam bekerja", bobot: "0.100" },
  { nomor: 5, keterangan: "Kejujuran dan kepercayaan", bobot: "0.100" },
  { nomor: 6, keterangan: "Kecakapan dalam menjalankan tugas", bobot: "0.100" },
  { nomor: 7, keterangan: "Kerjasama, koordinasi dalam tim dan antar tim", bobot: "0.100" },
  { nomor: 8, keterangan: "Komunikasi dengan pengurus dan karyawan", bobot: "0.100" },
  { nomor: 9, keterangan: "Bekerja secara efektif dalam jadwal kerja dan efisien dalam penggunaan waktu/resources", bobot: "0.050" },
  { nomor: 10, keterangan: "Prestasi kerja baik kualitas maupun kuantitas", bobot: "0.050" },
  { nomor: 11, keterangan: "Kemampuan dan kreativitas", bobot: "0.100" },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL tidak ditemukan. Pastikan .env.local sudah diisi.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log("Seeding template perilaku standar...");

  // Check if already exists
  const existing = await db
    .select({ id: penilaianTemplate.id })
    .from(penilaianTemplate)
    .where(eq(penilaianTemplate.nama, TEMPLATE_NAMA))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Template "${TEMPLATE_NAMA}" sudah ada (id: ${existing[0]!.id}). Skip.`);
    process.exit(0);
  }

  // Create template
  const [template] = await db
    .insert(penilaianTemplate)
    .values({
      nama: TEMPLATE_NAMA,
      tipe: "perilaku",
      isDefault: true,
    })
    .returning({ id: penilaianTemplate.id });

  console.log(`Template dibuat dengan id: ${template!.id}`);

  // Create items
  await db.insert(penilaianTemplateItem).values(
    DEFAULT_ITEMS.map((item) => ({
      templateId: template!.id,
      nomor: item.nomor,
      keterangan: item.keterangan,
      bobot: item.bobot,
    })),
  );

  console.log(`${DEFAULT_ITEMS.length} item berhasil ditambahkan.`);
  console.log("Total bobot:", DEFAULT_ITEMS.reduce((sum, i) => sum + parseFloat(i.bobot), 0).toFixed(3));
  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
