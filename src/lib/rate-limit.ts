import "server-only";
import { headers } from "next/headers";
import { sql } from "./db";

// Tries per visitor and action, counted in the database so every server instance sees the same
// count (serverless instances come and go). If the database can't be reached, a count kept in
// this instance's memory is used instead, so a hiccup never locks everyone out.

const hits = new Map<string, number[]>();

/** The visitor's IP. Netlify's own header can't be set by the browser; x-forwarded-for can. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-nf-client-connection-ip") ?? ((h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local");
}

/**
 * Counts one more try by this visitor for `action`; true when it went over `limit` within
 * `windowMs`. This machine itself (the local dev server and its tests) isn't counted: on Netlify
 * the visitor's real IP is always there.
 */
export async function tooManyFromHere(action: string, limit: number, windowMs: number) {
  const ip = await clientIp();
  if (LOCAL.test(ip)) return false;
  return tooMany(`${action}:${ip}`, limit, windowMs);
}

const LOCAL = /^(local|127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;

/** One more try for `key`; true when there were more than `limit` within `windowMs`. */
export async function tooMany(key: string, limit: number, windowMs: number) {
  try {
    const [{ n }] = await sql<{ n: number }[]>`
      with added as (insert into rate_hits (key) values (${key}) returning 1)
      select (select count(*)::int from rate_hits where key = ${key} and at > now() - make_interval(secs => ${windowMs / 1000})) + 1 as n`;
    // Now and then, sweep rows older than a day (the longest window used).
    if (Math.random() < 0.02) await sql`delete from rate_hits where at < now() - interval '1 day'`;
    return n > limit;
  } catch (e) {
    console.error("rate limit: database unavailable, counting in memory", e);
    return tooManyInMemory(key, limit, windowMs);
  }
}

function tooManyInMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return recent.length > limit;
}
