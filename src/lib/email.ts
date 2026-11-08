import { logoUrl } from "./business-logo";
import { referralCodeOf } from "./discounts";
import { poweredByUrl } from "./powered-by";
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Two ways to send, picked by what is set on the server:
// - Resend (RESEND_API_KEY + EMAIL_FROM, an address on the business's own domain): lands in the
//   inbox more often, 3,000 a month free. Replies go to GMAIL_USER when it is set.
// - Gmail with an App Password (GMAIL_USER + GMAIL_APP_PASSWORD): free, about 500 a day.
// Without either, email is simply not sent.

let transport: Transporter | null = null;

const resendOn = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
const gmailOn = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
export const emailConfigured = () => resendOn() || gmailOn();
/** The address clients see emails from, for the settings page. */
export const emailSender = () => (resendOn() ? process.env.EMAIL_FROM!.trim() : process.env.GMAIL_USER?.trim() ?? null);

type Mail = {
  to: string; subject: string; text: string; html: string; headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer | string; contentType: string }[];
};

// Tests point this at a local fake.
const resendUrl = (path: string) => `${(process.env.RESEND_API_URL ?? "https://api.resend.com").replace(/\/$/, "")}${path}`;

const resendBody = (fromName: string, m: Mail) => ({
  from: `${fromName.replace(/[<>"]/g, "")} <${process.env.EMAIL_FROM!.trim()}>`,
  to: [m.to],
  subject: m.subject,
  text: m.text,
  html: m.html,
  ...(process.env.GMAIL_USER ? { reply_to: process.env.GMAIL_USER.trim() } : {}),
  ...(m.headers ? { headers: m.headers } : {}),
  ...(m.attachments?.length
    ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64"), content_type: a.contentType })) }
    : {}),
});

async function resendPost(path: string, body: unknown) {
  const res = await fetch(resendUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Resend refused it (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Gmail; SMTP_HOST / SMTP_PORT point the tests at a local mail catcher instead.
function smtpServer() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return { host: process.env.SMTP_HOST ?? "smtp.gmail.com", port, secure: port === 465 };
}

function getTransport() {
  if (!gmailOn()) return null;
  transport ??= nodemailer.createTransport({
    ...smtpServer(),
    // Google shows app passwords as "abcd efgh ijkl mnop"; pasted with the spaces (or a stray
    // line break) they are refused, so keep only the letters.
    auth: { user: process.env.GMAIL_USER?.trim(), pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
  });
  return transport;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The appointment card shown under the message in appointment emails. */
export type EmailDetails = {
  heading: string;
  badge: string | null; // e.g. "Waiting for confirmation"
  when: string;
  address: string | null;
  pets: { name: string; services: { name: string; price: string }[] }[];
  total: string; // "" when no prices are set
  link: string | null;
  businessPhone: string | null;
  policy: string | null;
  // "Add to my calendar" buttons, and the .ics file attached to the email.
  calendar?: { apple: string; google: string; ics: string } | null;
};

const row = (label: string, value: string) =>
  `<tr><td style="padding:10px 0;border-top:1px solid #e1e6ee;color:#5d6b80;font-size:13px;width:90px;vertical-align:top">${label}</td><td style="padding:10px 0;border-top:1px solid #e1e6ee;font-size:15px">${value}</td></tr>`;

const calButton = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin:4px;border:2px solid #0a84cc;color:#0a84cc;text-decoration:none;font-weight:700;font-size:14px;padding:10px 16px;border-radius:999px">📅 ${label}</a>`;

function detailsHtml(d: EmailDetails) {
  const pets = d.pets
    .map((p) => `<strong>${escape(p.name)}</strong><br>${p.services
      .map((s) => `<span style="color:#5d6b80">${escape(s.name)}</span> &nbsp;${escape(s.price)}`).join("<br>")}`)
    .join("<br><br>");
  return `<div style="margin-top:24px;border:1px solid #e1e6ee;border-radius:16px;padding:18px 18px 8px">
<p style="margin:0 0 4px;font-size:20px;font-weight:800">${escape(d.heading)}</p>
${d.badge ? `<p style="margin:0 0 10px"><span style="display:inline-block;background:#fff4de;color:#9a5b00;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">${escape(d.badge)}</span></p>` : ""}
<table role="presentation" style="width:100%;border-collapse:collapse">
${row("When", `<strong>${escape(d.when)}</strong>`)}
${d.address ? row("Where", escape(d.address)) : ""}
${pets ? row("Pets", pets) : ""}
${d.total ? row("Estimated", `<strong>${escape(d.total)}</strong>`) : ""}
</table></div>
${d.link ? `<p style="margin:24px 0 0;text-align:center"><a href="${d.link}" style="display:inline-block;background:#0a84cc;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${d.badge === "Waiting for confirmation" ? "See my request" : "See, confirm or cancel"}</a></p>` : ""}
${d.calendar ? `<p style="margin:16px 0 0;text-align:center;font-size:14px;color:#5d6b80">Add it to your calendar so you don't forget:</p>
<p style="margin:8px 0 0;text-align:center">${calButton(d.calendar.apple, "Apple / iPhone")} ${calButton(d.calendar.google, "Google Calendar")}</p>` : ""}
${d.policy ? `<p style="margin:18px 0 0;color:#5d6b80;font-size:13px">${escape(d.policy)}</p>` : ""}
${d.businessPhone ? `<p style="margin:8px 0 0;color:#5d6b80;font-size:13px">Questions? Text us at <a href="sms:${escape(d.businessPhone)}" style="color:#0a84cc">${escape(d.businessPhone)}</a>.</p>` : ""}`;
}

/**
 * A business's email: its logo on top (when it has one), the message, then (for appointment emails) a card with
 * the date, address, pets and services, total and a button to see, confirm or cancel; the
 * business name at the bottom. Inline styles only, since email apps ignore style sheets.
 */
export function emailHtml(text: string, fromName: string, details?: EmailDetails | null, logoSrc?: string | null, poweredBy?: string | null) {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const link = details ? null : text.match(/https?:\/\/\S+\/a\/[0-9a-f]+/)?.[0];
  // With the card, the raw link in the text is redundant: the button opens it.
  const shown = details?.link ? text.replace(/\s*(See or change it here:|Please confirm or cancel here:)?\s*https?:\/\/\S+\/a\/[0-9a-f]+\S*/g, "") : text;
  const body = escape(shown)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0a84cc;word-break:break-all">$1</a>')
    .replace(/\n/g, "<br>");
  const logo = appUrl && logoSrc ? `<img src="${appUrl}${logoSrc}" width="120" alt="${escape(fromName)}" style="display:block;margin:0 auto 12px;border:0">` : "";
  const button = link
    ? `<p style="margin:24px 0 0;text-align:center"><a href="${link}" style="display:inline-block;background:#0a84cc;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">See my appointment</a></p>`
    : "";
  return `<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px 24px;color:#132039;font-size:16px;line-height:1.55">
${logo}<div>${body}</div>${details ? detailsHtml(details) : button}
</div>
<p style="max-width:520px;margin:16px auto 0;text-align:center;color:#5d6b80;font-size:13px">${escape(fromName)}${poweredBy ? `<br><span style="font-size:12px">Online booking by <a href="${escape(poweredBy)}" style="color:#5d6b80">Fino</a></span>` : ""}</p>
</div>`;
}

export async function sendEmail({
  to, subject, text, fromName, details, attachments = [], businessId,
}: {
  to: string; subject: string; text: string; fromName: string; details?: EmailDetails | null;
  /** Whose email it is: its logo goes on top. */
  businessId?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}) {
  // Emails with a businessId are the business's own, to its clients: they end with its "Online booking by Fino" referral link.
  const poweredBy = businessId ? poweredByUrl(await referralCodeOf(businessId)) : null;
  const mail: Mail = {
    to, subject, text: poweredBy ? `${text}\n\n—\nOnline booking by Fino: ${poweredBy}` : text,
    html: emailHtml(text, fromName, details, businessId ? await logoUrl(businessId) : null, poweredBy),
    // Gmail and Apple Mail show the attached visit with an "Add to calendar" option.
    attachments: [
      ...(details?.calendar
        ? [{ filename: "visit.ics", content: details.calendar.ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }]
        : []),
      ...attachments,
    ],
  };
  if (resendOn()) {
    await resendPost("/emails", resendBody(fromName, mail));
    return;
  }
  const t = getTransport();
  if (!t) throw new Error("Email is not set up (RESEND_API_KEY + EMAIL_FROM, or GMAIL_USER + GMAIL_APP_PASSWORD).");
  await t.sendMail({ from: { name: fromName, address: process.env.GMAIL_USER!.trim() }, ...mail });
}

/**
 * Sends several emails over one connection (marketing campaigns). Returns, for each email,
 * null when it was sent or the error message.
 */
export async function sendMany(
  fromName: string,
  mails: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }[],
) {
  if (!emailConfigured()) throw new Error("Email is not set up (RESEND_API_KEY + EMAIL_FROM, or GMAIL_USER + GMAIL_APP_PASSWORD).");
  if (resendOn()) {
    // Up to 100 per request; one failed request marks its whole group as failed.
    const out: (string | null)[] = [];
    for (let i = 0; i < mails.length; i += 100) {
      const group = mails.slice(i, i + 100);
      try {
        await resendPost("/emails/batch", group.map((m) => resendBody(fromName, m)));
        out.push(...group.map(() => null));
      } catch (e) {
        out.push(...group.map(() => String((e as Error).message).slice(0, 500)));
      }
    }
    return out;
  }
  const pool = nodemailer.createTransport({
    pool: true,
    maxConnections: 1,
    ...smtpServer(),
    auth: { user: process.env.GMAIL_USER?.trim(), pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
  });
  const from = { name: fromName, address: process.env.GMAIL_USER!.trim() };
  try {
    const out: (string | null)[] = [];
    for (const m of mails) {
      try {
        await pool.sendMail({ from, ...m });
        out.push(null);
      } catch (e) {
        out.push(String((e as Error).message).slice(0, 500));
      }
    }
    return out;
  } finally {
    pool.close();
  }
}
