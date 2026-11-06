"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { DateField } from "@/components/date-field";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import type { CampaignState } from "../actions";

// Step 3: a test to yourself, then send now or pick a day and time.

export function SendStep({ count, ownerEmail, today, sendTest, sendNow, schedule }: {
  count: number;
  ownerEmail: string;
  today: string;
  sendTest: (s: CampaignState, f: FormData) => Promise<CampaignState>;
  sendNow: (s: CampaignState) => Promise<CampaignState>;
  schedule: (s: CampaignState, f: FormData) => Promise<CampaignState>;
}) {
  const { t } = useT();
  const [test, testAction, testing] = useActionState(sendTest, undefined);
  const [now, nowAction, sending] = useActionState(sendNow, undefined);
  const [later, laterAction, scheduling] = useActionState(schedule, undefined);
  const [sure, setSure] = useState(false);
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-bold">{t("1. Send yourself a test")}</h2>
        <ActionForm action={testAction} className="flex gap-2">
          <Input name="to" type="email" defaultValue={ownerEmail} placeholder={t("you@gmail.com")} aria-label={t("Test email")} className="flex-1" />
          <Button type="submit" kind="secondary" disabled={testing}>{testing ? t("Sending…") : t("Send test")}</Button>
        </ActionForm>
        <FormPopup state={test} />
        {test?.sent && <Notice kind="success">{t("Sent to {sent}. Check how it looks on your phone.", { sent: test.sent })}</Notice>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">{t("2. Send it to {count} client", { count: count })}{count === 1 ? "" : "s"}</h2>
        <FormPopup state={now} />
        {!sure ? (
          <Button type="button" className="w-full py-3.5 text-base" onClick={() => setSure(true)}>{t("Send now")}</Button>
        ) : (
          <ActionForm action={() => nowAction()} className="space-y-2">
            <Notice kind="warn">{t("Emails can't be taken back once they go out. Send to {count} clients now?", { count: count })}</Notice>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" kind="secondary" onClick={() => setSure(false)}>{t("Not yet")}</Button>
              <Button type="submit" disabled={sending}>{sending ? t("Starting…") : t("Yes, send")}</Button>
            </div>
          </ActionForm>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">{t("Or schedule it")}</h2>
        <FormPopup state={later} />
        <ActionForm action={laterAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Day")}><DateField name="date" min={today} defaultValue={today} required /></Field>
            <Field label={t("Time")}><Input type="time" name="time" step={900} defaultValue="09:00" required /></Field>
          </div>
          <Button type="submit" kind="secondary" className="w-full" disabled={scheduling}>{scheduling ? t("Saving…") : t("Schedule")}</Button>
          <p className="text-xs text-muted">{t("Scheduled emails start when the app next checks in (every hour, or when your iPhone collects the texts).")}</p>
        </ActionForm>
      </Card>
    </div>
  );
}

/** While a campaign is sending and this page is open, keeps sending the next batch. */
export function SendingProgress({ sent, total, next }: { sent: number; total: number; next: () => Promise<number> }) {
  const { t } = useT();
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let stop = false;
    let before = -1;
    (async () => {
      while (!stop) {
        let left: number;
        try {
          left = await next();
        } catch {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        router.refresh();
        if (left === 0 || stop) break;
        // Nothing went out (the daily Gmail limit): stop here, the jobs finish it tomorrow.
        if (left === before) {
          setPaused(true);
          break;
        }
        before = left;
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pct = total ? Math.round((sent / total) * 100) : 0;
  return (
    <Card className="space-y-2">
      <div className="flex justify-between text-sm font-semibold"><span>{t("Sending…")}</span><span>{t("{sent} of {total}", { sent: sent, total: total })}</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-bg"><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
      <p className="text-xs text-muted">
        {paused ? t("Today's Gmail limit was reached; the rest goes out tomorrow on its own.")
          : t("Keep this page open to send faster. If you close it, the rest goes out on its own over the next hours.")}
      </p>
    </Card>
  );
}
