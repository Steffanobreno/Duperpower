import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Sends through the business Gmail account with an App Password (free, about 500/day).
// Set GMAIL_USER and GMAIL_APP_PASSWORD. Without them, email is simply not sent.

let transport: Transporter | null = null;

export const emailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

function getTransport() {
  if (!emailConfigured()) return null;
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transport;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * The Woofers email: logo on top, the message, a big button for the client's appointment
 * link (see, confirm or cancel), and the business name at the bottom. Inline styles only,
 * since email apps ignore style sheets.
 */
export function emailHtml(text: string, fromName: string) {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const body = escape(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0a84cc;word-break:break-all">$1</a>')
    .replace(/\n/g, "<br>");
  const link = text.match(/https?:\/\/\S+\/a\/[0-9a-f]+/)?.[0];
  const logo = appUrl ? `<img src="${appUrl}/logo.png" width="120" alt="${escape(fromName)}" style="display:block;margin:0 auto 8px;border:0">` : "";
  const button = link
    ? `<p style="margin:24px 0 0;text-align:center"><a href="${link}" style="display:inline-block;background:#0a84cc;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">See my appointment</a></p>`
    : "";
  return `<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px 24px;color:#132039;font-size:16px;line-height:1.55">
${logo}<div>${body}</div>${button}
</div>
<p style="max-width:520px;margin:16px auto 0;text-align:center;color:#5d6b80;font-size:13px">${escape(fromName)} · Mobile dog grooming in the Bay Area</p>
</div>`;
}

export async function sendEmail({ to, subject, text, fromName }: { to: string; subject: string; text: string; fromName: string }) {
  const t = getTransport();
  if (!t) throw new Error("Email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD).");
  await t.sendMail({ from: { name: fromName, address: process.env.GMAIL_USER! }, to, subject, text, html: emailHtml(text, fromName) });
}
