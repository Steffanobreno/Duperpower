import "server-only";
import { sql } from "./db";

const startedAt = Date.now();

/**
 * Where the app runs and how far the database is, for the admin's "Velocidade" panel: the server's
 * region (Netlify sets AWS_REGION), the database's region (from its host name on Neon), and how
 * long one trip to the database takes now.
 */
export async function speedCheck() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();
  const dbRegion = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws\.neon\.tech$/)?.[1] ?? host.match(/\.([a-z]+-[a-z]+\d?)\.azure\.neon\.tech$/)?.[1] ?? null;
  const serverRegion = process.env.AWS_REGION ?? process.env.VERCEL_REGION ?? null;
  const trips: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t = performance.now();
    await sql`select 1`;
    trips.push(performance.now() - t);
  }
  // The first trip may include waking the database or opening the connection.
  const [first, ...rest] = trips;
  const tripMs = Math.round(rest.reduce((a, b) => a + b, 0) / rest.length);
  return { serverRegion, dbRegion, firstMs: Math.round(first), tripMs, warmForMin: Math.round((Date.now() - startedAt) / 60_000) };
}
