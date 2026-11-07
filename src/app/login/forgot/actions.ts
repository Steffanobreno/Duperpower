"use server";
import { createPasswordReset } from "@/lib/auth";
import { emailConfigured, sendEmail } from "@/lib/email";
import { isLang, makeT } from "@/lib/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import { OWNER_MESSAGES } from "@/lib/i18n/owner";
import { APP_NAME } from "@/lib/product";
import { tooManyFromHere } from "@/lib/rate-limit";

export type ForgotState = { error?: string; sent?: boolean } | undefined;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Sends the reset link. The answer is the same whether or not the email has an account, so
// the page can't be used to find out who uses the app.
export async function forgotPasswordAction(_: ForgotState, form: FormData): Promise<ForgotState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (await tooManyFromHere("forgot", 10, 3600_000)) return { error: "Too many wrong tries. Wait 15 minutes and try again." };
  const reset = await createPasswordReset(email);
  if (reset && emailConfigured()) {
    // In the language they use the app in (else the one this phone is in).
    const lang = isLang(reset.language) ? reset.language : (await getOwnerI18n()).lang;
    const t = makeT(OWNER_MESSAGES[lang]);
    const link = `${appUrl()}/login/reset/${reset.token}`;
    await sendEmail({
      to: email.toLowerCase(),
      subject: t("Reset your {app} password", { app: APP_NAME }),
      fromName: APP_NAME,
      text: [
        t("To choose a new password, open this link (it works once, for one hour):"),
        link,
        t("If you didn't ask for this, ignore this email: your password stays the same."),
      ].join("\n\n"),
    }).catch((e) => console.error("reset email failed", e));
  }
  return { sent: true };
}
