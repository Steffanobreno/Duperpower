"use client";
import { useActionState, useState } from "react";
import { useT } from "@/components/i18n";
import { ActionForm } from "@/components/action-form";
import { FormPopup } from "@/components/popup";
import { Button, Card } from "@/components/ui";
import { ABANDONED_TEMPLATES, templateLabel } from "@/lib/abandoned-templates";
import { sendAllAction } from "../send-actions";

/**
 * "Send to all" for abandoned bookings: pick a message from the menu (or Random: each person gets
 * one of the 20 ready ones) and edit it → emails go out at once →
 * the texts are a queue, one tap each opens Messages with that person's text filled in.
 */
export function SendAll({ count, withEmail, finish, sorry, subject }: {
  count: number; withEmail: number; finish: string; sorry: string; subject: string;
}) {
  const { t } = useT();
  const [state, action, pending] = useActionState(sendAllAction, undefined);
  const [choice, setChoice] = useState("random");
  const [body, setBody] = useState(finish);
  const textFor = (c: string) => (c === "finish" ? finish : c === "sorry" ? sorry : ABANDONED_TEMPLATES[Number(c)] ?? "");
  const [sent, setSent] = useState<string[]>([]);

  if (state?.texts) {
    const next = state.texts.find((x) => !sent.includes(x.id));
    // A real link to Messages ("?&body=" works on iPhone and Android alike): the phone opens it
    // most reliably from a tap. (Everyone was already marked contacted when the message went out.)
    const smsHref = (x: (typeof state.texts)[number]) => `sms:${x.phone}?&body=${encodeURIComponent(x.body)}`;
    const opened = (id: string) => setSent((s) => (s.includes(id) ? s : [...s, id]));
    return (
      <div className="space-y-4">
        <Card className="space-y-1">
          <p className="font-bold">{t("Emails sent: {n}", { n: state.emailed ?? 0 })}</p>
          <p className="text-sm text-muted">
            {t("Now the texts: each tap opens Messages with that person's text ready. Tap send there, then come back for the next.")}
          </p>
        </Card>
        {next ? (
          <a href={smsHref(next)} onClick={() => opened(next.id)}
            className="block w-full rounded-full bg-brand px-6 py-4 text-center text-lg font-semibold text-on-brand">
            {t("Text {name} ({done} of {total})", { name: next.name, done: sent.length + 1, total: state.texts.length })}
          </a>
        ) : (
          <p role="status" className="card p-4 text-center font-bold text-success">{t("All {n} texts opened. Done!", { n: state.texts.length })}</p>
        )}
        <ul className="space-y-2" aria-label={t("Texts to send")}>
          {state.texts.map((x) => (
            <li key={x.id} className="card flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{x.name}</span>
                <span className="block truncate text-xs text-muted">{x.body}</span>
              </span>
              <a href={smsHref(x)} onClick={() => opened(x.id)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${sent.includes(x.id) ? "border-success text-success" : "border-line text-brand"}`}>
                {sent.includes(x.id) ? t("Opened ✓") : t("Text")}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ActionForm action={action} className="space-y-4">
      <FormPopup state={state} />
      <Card className="space-y-1">
        <p className="font-bold">{t("{n} people started booking and didn't finish", { n: count })}</p>
        <p className="text-sm text-muted">{t("Last 30 days, not booked since. {e} left an email (sent at once); the texts go out from your phone, one tap each.", { e: withEmail })}</p>
      </Card>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">{t("Message to start from")}</span>
        <select value={choice} onChange={(e) => { setChoice(e.target.value); if (e.target.value !== "random") setBody(textFor(e.target.value)); }}
          className="block w-full rounded-2xl border border-line bg-surface px-4 py-3">
          <option value="random">{t("Random: a different message for each person")}</option>
          <option value="finish">{t("Finish your booking")}</option>
          <option value="sorry">{t("Sorry, it's fixed")}</option>
          {ABANDONED_TEMPLATES.map((x, i) => <option key={i} value={String(i)}>{templateLabel(x, i + 1)}</option>)}
        </select>
      </label>
      <input type="hidden" name="mode" value={choice === "random" ? "random" : "one"} />
      {choice === "random" ? (
        <p className="card p-4 text-sm">{t("Each person gets one of the 20 messages, picked at random.")}</p>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t("Message")}</span>
          <textarea name="body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} required
            className="block w-full rounded-2xl border border-line bg-surface px-4 py-3" />
          <span className="mt-1 block text-xs text-muted">{t("{client}, {pet} and {booking_url} are filled in for each person (the link opens with their phone number).")}</span>
        </label>
      )}
      <input type="hidden" name="subject" value={subject} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("Sending…") : t("Send to all {n}", { n: count })}
      </Button>
    </ActionForm>
  );
}
