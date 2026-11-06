import "server-only";
import { sql } from "../db";
import { msg } from "@/lib/i18n";

// The owner's own lists for clients and pets. Each list starts with sensible defaults.

export const OPTION_KINDS = {
  client_tag: { title: msg("Client tags"), one: msg("tag"), hint: msg("Mark clients: VIP, generous tipper, every 4 weeks…") },
  referral_source: { title: msg("Referral sources"), one: msg("source"), hint: msg("How clients found you. Pick it on the client.") },
  coat_type: { title: msg("Coat types"), one: msg("coat type"), hint: msg("The choices for a pet's coat.") },
  behavior: { title: msg("Behavior"), one: msg("behavior"), hint: msg("Quick behavior tags on the pet.") },
  vaccine: { title: msg("Vaccines"), one: msg("vaccine"), hint: msg("Suggested names when adding a vaccine.") },
  breed: { title: msg("Extra breeds"), one: msg("breed"), hint: msg("Breeds or mixes missing from the built-in list (300+ breeds).") },
} as const;
export type OptionKind = keyof typeof OPTION_KINDS;
export const isOptionKind = (k: unknown): k is OptionKind => typeof k === "string" && k in OPTION_KINDS;

const DEFAULTS: Record<OptionKind, string[]> = {
  client_tag: ["VIP", "Great tipper", "Every 4 weeks", "Every 2 weeks", "No-show before", "Pays late"],
  referral_source: ["Google", "Instagram", "Facebook", "Yelp", "Nextdoor", "Friend or family", "Saw the van", "Website"],
  coat_type: ["Double", "Curly", "Wire", "Long", "Medium", "Short", "Smooth", "Corded", "Hairless"],
  behavior: ["Friendly", "Shy", "Nervous", "Fearful", "Noisy", "Biter"],
  vaccine: ["Rabies", "DHPP", "Bordetella", "Leptospirosis", "Canine influenza", "Lyme", "Distemper", "Parvovirus"],
  breed: [],
};

const DEFAULT_CODES = [
  { label: "Matted", color: "#92400e", description: "Coat is matted; may need a shave-down" },
  { label: "Biter", color: "#dc2626", description: "May bite; muzzle or extra care" },
  { label: "Senior", color: "#334155", description: "Older dog; go slow, short sessions" },
  { label: "Anxious", color: "#9333ea", description: "Nervous; quiet dryer, breaks" },
  { label: "Skin", color: "#db2777", description: "Sensitive skin; special shampoo" },
  { label: "Meds", color: "#0284c7", description: "Takes medication" },
];

async function seedOnce(businessId: string) {
  await sql.begin(async (tx) => {
    const [b] = await tx`update businesses set options_seeded = true
                         where id = ${businessId} and not options_seeded returning id`;
    if (!b) return;
    for (const [kind, labels] of Object.entries(DEFAULTS)) {
      for (const [i, label] of labels.entries()) {
        await tx`insert into option_lists (business_id, kind, label, sort_order)
                 values (${businessId}, ${kind}, ${label}, ${i}) on conflict do nothing`;
      }
    }
    for (const [i, c] of DEFAULT_CODES.entries()) {
      await tx`insert into pet_codes (business_id, label, color, description, sort_order)
               values (${businessId}, ${c.label}, ${c.color}, ${c.description}, ${i}) on conflict do nothing`;
    }
  });
}

export type Option = { id: string; label: string };

/** Every list of the business, in the owner's order. */
export async function allOptions(businessId: string): Promise<Record<OptionKind, Option[]>> {
  await seedOnce(businessId);
  const rows = await sql<{ id: string; kind: OptionKind; label: string }[]>`
    select id, kind, label from option_lists where business_id = ${businessId} order by kind, sort_order, label`;
  const out = Object.fromEntries(Object.keys(OPTION_KINDS).map((k) => [k, [] as Option[]])) as unknown as Record<OptionKind, Option[]>;
  for (const r of rows) out[r.kind].push({ id: r.id, label: r.label });
  return out;
}

export async function optionLabels(businessId: string, kind: OptionKind) {
  return (await allOptions(businessId))[kind].map((o) => o.label);
}

export type PetCode = { id: string; label: string; color: string; description: string | null };

export async function listPetCodes(businessId: string) {
  return sql<PetCode[]>`select id, label, color, description from pet_codes
                        where business_id = ${businessId} order by sort_order, label`;
}

/** The codes on each pet, as a map pet id → codes. */
export async function petCodesFor(petIds: string[]) {
  const out = new Map<string, PetCode[]>();
  if (!petIds.length) return out;
  const rows = await sql<(PetCode & { pet_id: string })[]>`
    select pp.pet_id, c.id, c.label, c.color, c.description from pet_pet_codes pp
    join pet_codes c on c.id = pp.pet_code_id
    where pp.pet_id = any(${petIds}) order by c.sort_order, c.label`;
  for (const r of rows) out.set(r.pet_id, [...(out.get(r.pet_id) ?? []), r]);
  return out;
}

/** Each client's tags, as a map client id → labels. */
export async function clientTagsFor(clientIds: string[]) {
  const out = new Map<string, string[]>();
  if (!clientIds.length) return out;
  const rows = await sql<{ client_id: string; label: string }[]>`
    select client_id, label from client_tags where client_id = any(${clientIds}) order by label`;
  for (const r of rows) out.set(r.client_id, [...(out.get(r.client_id) ?? []), r.label]);
  return out;
}
