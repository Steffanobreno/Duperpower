"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { sendTestEmailAction } from "../actions";

export function TestEmailButton() {
  const { t } = useT();
  const [state, action, pending] = useActionState(sendTestEmailAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <FormPopup state={state} />
      {state?.sentTo && <Notice kind="success">{t("Sent to {sentTo}. Check the inbox (and the spam folder the first time).", { sentTo: state.sentTo })}</Notice>}
      <Button type="submit" kind="secondary" disabled={pending}>{pending ? t("Sending…") : t("Send me a test email")}</Button>
    </form>
  );
}
