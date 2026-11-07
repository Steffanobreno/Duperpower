import "server-only";
import { createHash } from "node:crypto";
import { sql } from "./db";
import { emailConfigured, sendEmail } from "./email";
import { APP_NAME } from "./product";

// Server errors: kept (grouped) for /admin → Erros, and an email to the app owner (ADMIN_EMAILS)
// the first time an error shows up, then at most once a day for the same one, and never more
// than 10 alert emails a day. No outside service.

const MAX_EMAILS_A_DAY = 10;

export async function logServerError(message: string, path: string, digest: string | null) {
  // Only the route's file path (no ids or query) groups the same error together.
  const where = path.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}|[0-9a-f]{24,}|\d{3,}/gi, ":id");
  const fingerprint = createHash("sha1").update(`${message}\n${where}`).digest("hex");
  const [row] = await sql<{ id: string; count: number; emailed_at: Date | null }[]>`
    insert into app_errors (fingerprint, message, path, digest) values (${fingerprint}, ${message.slice(0, 2000)}, ${where.slice(0, 300)}, ${digest})
    on conflict (fingerprint) do update set count = app_errors.count + 1, last_at = now(), digest = coalesce(excluded.digest, app_errors.digest)
    returning id, count, emailed_at`;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (!admins.length || !emailConfigured()) return;
  if (row.emailed_at && row.emailed_at.getTime() > Date.now() - 86_400_000) return;
  const [{ today }] = await sql`select count(*)::int as today from app_errors where emailed_at > now() - interval '1 day'`;
  if (today >= MAX_EMAILS_A_DAY) return;
  // Claim the email (two errors at once send one).
  const [claimed] = await sql`update app_errors set emailed_at = now()
    where id = ${row.id} and (emailed_at is null or emailed_at < now() - interval '1 day') returning id`;
  if (!claimed) return;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  await sendEmail({
    to: admins.join(", "),
    subject: `[${APP_NAME}] Erro no servidor: ${message.slice(0, 80)}`,
    fromName: APP_NAME,
    text: [
      `Página: ${where}`,
      `Erro: ${message.slice(0, 1000)}`,
      row.count > 1 ? `Já aconteceu ${row.count} vezes.` : "Primeira vez.",
      digest ? `Código (digest) para procurar nos logs do Netlify: ${digest}` : "",
      `Todos os erros: ${appUrl}/admin/errors`,
    ].filter(Boolean).join("\n\n"),
  });
}
