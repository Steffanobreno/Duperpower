"use server";
import { accountEmail, requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/email";
import { msg } from "@/lib/i18n";
import { APP_NAME } from "@/lib/product";
import { askAssistant, type Turn } from "@/lib/help/assistant";

const DAILY_LIMIT = 40; // questions per business per day

export type AskResult = { answer?: string; id?: string; error?: string };

/** One question to the help assistant, with the conversation so far. */
export async function askHelpAction(question: string, history: Turn[]): Promise<AskResult> {
  const staff = await requireStaff();
  const q = String(question ?? "").trim().slice(0, 2000);
  if (q.length < 3) return { error: msg("Type your question.") };
  const [{ n }] = await sql`select count(*)::int as n from help_questions
                            where business_id = ${staff.businessId} and created_at > now() - interval '1 day'`;
  if (n >= DAILY_LIMIT) return { error: msg("That's a lot of questions today. Try the articles below, or talk to a person.") };
  const clean = (Array.isArray(history) ? history : [])
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-6);
  const answer = await askAssistant(q, clean, staff.lang);
  const [row] = await sql`insert into help_questions (business_id, staff_id, lang, question, answer)
                          values (${staff.businessId}, ${staff.staffId}, ${staff.lang}, ${q}, ${answer}) returning id`;
  if (!answer) return { id: row.id, error: msg("The assistant isn't available right now. Try the articles below, or talk to a person.") };
  return { answer, id: row.id };
}

/** Was the answer helpful? (shown to the app owner on the dashboard) */
export async function rateAnswerAction(id: string, helpful: boolean) {
  const staff = await requireStaff();
  await sql`update help_questions set helpful = ${!!helpful} where id = ${id} and business_id = ${staff.businessId}`;
}

/** "Talk to a person": the question goes by email to the app's support team. */
export async function talkToPersonAction(_: { sent?: boolean; error?: string } | undefined, form: FormData) {
  const staff = await requireStaff();
  const message = String(form.get("message") ?? "").trim().slice(0, 4000);
  if (message.length < 5) return { error: msg("Tell us what you need help with.") };
  const to = (process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  const email = await accountEmail(staff.staffId);
  await sql`insert into help_questions (business_id, staff_id, lang, question, escalated)
            values (${staff.businessId}, ${staff.staffId}, ${staff.lang}, ${message}, true)`;
  if (!to || !emailConfigured()) return { sent: true }; // kept on the dashboard even without email
  await sendEmail({
    to,
    subject: `${APP_NAME} support: ${staff.businessName}`,
    fromName: APP_NAME,
    text: [`${staff.staffName} (${email ?? "no email"}) at ${staff.businessName} needs help:`, "", message,
           "", `Business id: ${staff.businessId} · language: ${staff.lang} · country: ${staff.region.country}`].join("\n"),
  }).catch(() => null);
  return { sent: true };
}
