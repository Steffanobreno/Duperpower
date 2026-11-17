import { createHash, timingSafeEqual } from "node:crypto";
import { runMessagingJobs } from "@/lib/messaging";
import { runLifecycleEmails } from "@/lib/lifecycle";
import { runFakeRenewals } from "@/lib/fake-payments";

// Hourly job (Hostinger cron or GitHub Actions) so emails go out even when the phone is off.
// Call with header "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await runMessagingJobs();
  // The owners' own emails: trial ending, first visit (each once).
  const lifecycle = await runLifecycleEmails().catch((e) => {
    console.error("lifecycle emails failed", e);
    return 0;
  });
  // Test mode's subscriptions (no Stripe yet): renewed, or ended, when their period is over.
  const fakeRenewals = await runFakeRenewals().catch((e) => {
    console.error("test-mode renewals failed", e);
    return 0;
  });
  return Response.json({ ok: true, lifecycle, fakeRenewals });
}

/** Compares in constant time (hashes first, so lengths don't leak either). */
function sameSecret(a: string, b: string) {
  const h = (x: string) => createHash("sha256").update(x).digest();
  return timingSafeEqual(h(a), h(b));
}
