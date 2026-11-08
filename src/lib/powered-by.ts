/** The "Online booking by Fino" link: the groomer's referral code, so a sign-up through it counts as their referral. */
export const poweredByUrl = (code: string) =>
  `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/?ref=${encodeURIComponent(code)}&utm_source=powered_by`;
