import { sql } from "@/lib/db";

// A pet's own prices (see db/migrations/0018_pet_prices.sql).

export type PetPrice = { pet_id: string; service_id: string; price_cents: number; duration_min: number | null };

/** Every custom price for these pets, as "petId:serviceId" → price. */
export async function petPrices(petIds: string[]): Promise<Map<string, PetPrice>> {
  if (petIds.length === 0) return new Map();
  const rows = await sql<PetPrice[]>`
    select pet_id, service_id, price_cents, duration_min from pet_service_prices where pet_id = any(${petIds}::uuid[])`;
  return new Map(rows.map((r) => [`${r.pet_id}:${r.service_id}`, r]));
}

/** The service as booked for this pet: its own price and time when it has one. */
export function forPet<S extends { id: string; price_cents: number; duration_min: number }>(
  prices: Map<string, PetPrice>,
  petId: string | null | undefined,
  service: S,
): S {
  const own = petId ? prices.get(`${petId}:${service.id}`) : undefined;
  if (!own) return service;
  return { ...service, price_cents: own.price_cents, duration_min: own.duration_min ?? service.duration_min };
}
