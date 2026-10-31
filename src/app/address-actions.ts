"use server";
import { addressOf, suggestAddresses, type PickedAddress, type Suggestion } from "@/lib/maps";

// Address suggestions for the booking page and the owner's forms. Public, so each typing
// session (one random token per address field) gets a limited number of lookups.

const used = new Map<string, number>();
const MAX_PER_SESSION = 40;
const TOKEN = /^[0-9a-f-]{36}$/;

function allow(token: string) {
  if (!TOKEN.test(token)) return false;
  const n = (used.get(token) ?? 0) + 1;
  used.set(token, n);
  if (used.size > 5000) used.clear();
  return n <= MAX_PER_SESSION;
}

export async function addressSuggestionsAction(input: string, token: string): Promise<Suggestion[]> {
  if (typeof input !== "string" || typeof token !== "string" || !allow(token)) return [];
  return suggestAddresses(input, token);
}

export async function pickAddressAction(placeId: string, token: string): Promise<PickedAddress | null> {
  if (typeof placeId !== "string" || typeof token !== "string" || !allow(token)) return null;
  return addressOf(placeId, token);
}
