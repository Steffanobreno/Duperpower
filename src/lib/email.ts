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

/** Plain message as text plus a simple HTML version with clickable links. */
export async function sendEmail({ to, subject, text, fromName }: { to: string; subject: string; text: string; fromName: string }) {
  const t = getTransport();
  if (!t) throw new Error("Email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD).");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5">${escape(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>")}</div>`;
  await t.sendMail({ from: { name: fromName, address: process.env.GMAIL_USER! }, to, subject, text, html });
}
