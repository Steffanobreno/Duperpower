"use server";
import { addressOf, suggestAddresses, type PickedAddress, type Suggestion } from "@/lib/maps";
import { tooManyFromHere } from "@/lib/rate-limit";

// Address suggestions for the booking page and the owner's forms. Public, so each typing
// session (one random token per address field) gets a limited number of lookups.

const used = new Map<string, number>();
const MAX_PER_SESSION = 40;
const TOKEN = /^[0-9a-f-]{36}$/;

// The token is chosen by the browser, so each visitor (IP) also has a cap: Google bills every lookup.
const PER_IP_PER_HOUR = 300;

async function allow(token: string) {
  if (!TOKEN.test(token)) return false;
  if (await tooManyFromHere("address", PER_IP_PER_HOUR, 3600_000)) return false;
  const n = (used.get(token) ?? 0) + 1;
  used.set(token, n);
  if (used.size > 5000) used.clear();
  return n <= MAX_PER_SESSION;
}

export async function addressSuggestionsAction(input: string, token: string, country = "US"): Promise<Suggestion[]> {
  if (typeof input !== "string" || typeof token !== "string" || !(await allow(token))) return [];
  return suggestAddresses(input, token, typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : "US");
}

export async function pickAddressAction(placeId: string, token: string): Promise<PickedAddress | null> {
  if (typeof placeId !== "string" || typeof token !== "string" || !(await allow(token))) return null;
  return addressOf(placeId, token);
}
