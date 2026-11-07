// Shared by server and client code (no "server-only" here).
import { msg } from "@/lib/i18n";
export const PAYMENT_METHODS = [
  { value: "cash", label: msg("Cash") },
  // Recorded only: the groomer's own card reader (Square, SumUp...) takes the card.
  { value: "card", label: msg("Card") },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "check", label: msg("Check") },
  { value: "bitcoin", label: "Bitcoin" },
  { value: "other", label: msg("Other") },
] as const;

export const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
