// The app's own name and pitch (the product sold to groomers), in one place. Each business's
// own name shows on its client pages, messages and receipts; this one shows on the login,
// signup, sales page and the installed app's icon. Change NEXT_PUBLIC_APP_NAME to rename it.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Duperpower";
export const APP_TAGLINE = "Scheduling, routes, reminders and checkout for mobile pet groomers.";

/**
 * The first business (Woofers Dog Spa) has its artwork in /public (logo, header logo, van photo,
 * receipt logo). Every other business shows its own uploaded logo, or its initials until it has one.
 */
export const hasBuiltInArtwork = (businessName?: string | null) => /^woofers\b/i.test((businessName ?? "").trim());

/** "Happy Paws Grooming" → "HP": the stand-in for a logo that isn't uploaded yet. */
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "•";
