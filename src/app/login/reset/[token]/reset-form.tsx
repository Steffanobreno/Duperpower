"use client";
import { useActionState } from "react";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input } from "@/components/ui";
import { resetPasswordAction } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(resetPasswordAction.bind(null, token), undefined);
  return (
    // Just set a new password: the app lock doesn't ask for the PIN right away.
    <ActionForm action={(f) => { try { sessionStorage.setItem("woofers:unlocked-at", String(Date.now())); } catch {} action(f); }} className="space-y-4">
      <FormPopup state={state} />
      <Field label={t("New password")} hint={t("At least 10 characters.")}>
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label={t("Repeat password")}>
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("One moment…") : t("Save and log in")}
      </Button>
    </ActionForm>
  );
}
