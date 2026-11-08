import { msg } from "@/lib/i18n";

// What the groomer noticed or did on a cut. Stored as keys on pet_grooms.tags; shown on the
// pet's report card.
export const GROOM_TAGS = ["calm", "nervous", "matting", "sensitive_skin", "ear_care", "nails_done", "teeth_brushed", "flea_found"] as const;
export type GroomTag = (typeof GROOM_TAGS)[number];

export const GROOM_TAG_LABEL: Record<GroomTag, string> = {
  calm: msg("Calm"),
  nervous: msg("Nervous"),
  matting: msg("Matting"),
  sensitive_skin: msg("Sensitive skin"),
  ear_care: msg("Ear care"),
  nails_done: msg("Nails done"),
  teeth_brushed: msg("Teeth brushed"),
  flea_found: msg("Fleas found"),
};
