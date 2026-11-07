import "server-only";
import { headers } from "next/headers";

// Best effort, per server instance: slows down one visitor hammering a public action.
// Not a hard guarantee (each serverless instance counts on its own).

const hits = new Map<string, number[]>();

/** The visitor's IP. Netlify's own header can't be set by the browser; x-forwarded-for can. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-nf-client-connection-ip") ?? ((h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local");
}

/**
 * Counts one more try by this visitor for `action`; true when it went over `limit` within
 * `windowMs`. Requests with no IP at all (the local dev server and its tests) aren't counted.
 */
export async function tooManyFromHere(action: string, limit: number, windowMs: number) {
  const ip = await clientIp();
  return ip !== "local" && tooMany(`${action}:${ip}`, limit, windowMs);
}

function tooMany(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return recent.length > limit;
}
