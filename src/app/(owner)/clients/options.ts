import type { Option, OptionKind } from "@/lib/data/options";
import type { ClientOptions, PetOptions } from "./forms";

// The owner's lists, shaped for the client and pet forms.
type Lists = Record<OptionKind, Option[]>;
const labels = (o: Option[]) => o.map((x) => x.label);

export const clientOptions = (l: Lists): ClientOptions => ({ tags: labels(l.client_tag), sources: labels(l.referral_source) });
export const petOptions = (l: Lists): PetOptions => ({ coats: labels(l.coat_type), behaviors: labels(l.behavior), breeds: labels(l.breed) });
