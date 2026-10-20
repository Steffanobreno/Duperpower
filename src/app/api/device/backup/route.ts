import { formatInTimeZone } from "date-fns-tz";
import { buildBackup } from "@/lib/backup";
import { clientsCsv } from "@/lib/clients-csv";
import { sql } from "@/lib/db";
import { businessForDeviceKey } from "@/lib/device";

// Read once a week by the Google Apps Script in Settings → Backups, which saves the files
// in a "Woofers backups" folder on the Woofers Google Drive.
// ?file=data → everything as JSON; ?file=clients → the client list as a spreadsheet (CSV).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const business = await businessForDeviceKey(url.searchParams.get("key"));
  if (!business) return new Response("Unknown key", { status: 401 });
  const stamp = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd");
  if (url.searchParams.get("file") === "clients") {
    return new Response(await clientsCsv(business.id, business.timezone), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="woofers-clients-${stamp}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const backup = await buildBackup(business.id);
  await sql`update businesses set backup_at = now() where id = ${business.id}`;
  return new Response(JSON.stringify(backup), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="woofers-backup-${stamp}.json"`, "Cache-Control": "no-store" },
  });
}
