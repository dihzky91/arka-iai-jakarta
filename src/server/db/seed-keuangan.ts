import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { roles, roleCapabilities } from "./schema";

const KEUANGAN_CAPABILITIES = [
  "keuangan:view",
  "keuangan:process",
  "keuangan:pay",
  "keuangan:export",
  "jadwal_pelatihan:view",
  "jadwal_ujian:view",
  "notification:view",
  "notification:manage",
  "calendar:view",
  "calendar:manage",
  "search:view",
  "profile:view",
  "profile:edit",
];

async function main() {
  console.log("Seeding role keuangan...");

  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(sql`${roles.kode} = 'keuangan'`)
    .limit(1);

  if (existing.length > 0) {
    console.log("Role keuangan sudah ada, me-skip seed.");
    return;
  }

  const roleId = await db
    .insert(roles)
    .values({
      nama: "Keuangan",
      kode: "keuangan",
      isSystem: false,
      createdBy: "seed",
    })
    .returning({ id: roles.id });

  const id = roleId[0]?.id;
  if (!id) {
    console.error("Gagal membuat role keuangan.");
    return;
  }

  await db.insert(roleCapabilities).values(
    KEUANGAN_CAPABILITIES.map((capa) => ({
      roleId: id,
      capability: capa,
    })),
  );

  console.log(`Role keuangan berhasil dibuat dengan ${KEUANGAN_CAPABILITIES.length} capabilities.`);
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exit(1);
  })
  .then(() => {
    console.log("Seed selesai.");
    process.exit(0);
  });
