import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "[db] DATABASE_URL belum di-set. Isi .env.local sebelum menjalankan query DB.",
  );
}

// WebSocket diperlukan di Node.js (development & SSR).
// Di edge runtime (Vercel Edge, Cloudflare Workers), WebSocket sudah tersedia secara native.
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({
  connectionString: databaseUrl ?? "postgresql://invalid:invalid@invalid/invalid",
});

export const db = drizzle(pool, { schema });
export { schema };
export type DB = typeof db;
