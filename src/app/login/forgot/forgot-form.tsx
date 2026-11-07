"use client";
import { useActionState } from "react";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input } from "@/components/ui";
import { forgotPasswordAction } from "./actions";

export function ForgotForm() {
  const { t } = useT();
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  if (state?.sent) {
    return <p role="status" className="text-center">{t("If an account has this email, a link is on its way. Check your inbox (and spam).")}</p>;
  }
  return (
    <ActionForm action={action} className="space-y-4">
      <FormPopup state={state} />
      <Field label={t("Email")}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("One moment…") : t("Send me the link")}
      </Button>
    </ActionForm>
  );
}
