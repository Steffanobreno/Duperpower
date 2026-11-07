import { runMessagingJobs } from "@/lib/messaging";
import { runLifecycleEmails } from "@/lib/lifecycle";

// Hourly job (Hostinger cron or GitHub Actions) so emails go out even when the phone is off.
// Call with header "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await runMessagingJobs();
  // The owners' own emails: trial ending, first visit (each once).
  const lifecycle = await runLifecycleEmails().catch((e) => {
    console.error("lifecycle emails failed", e);
    return 0;
  });
  return Response.json({ ok: true, lifecycle });
}
