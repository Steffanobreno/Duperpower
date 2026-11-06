"use client";
import { useT } from "@/components/i18n";
import { FormPopup } from "@/components/popup";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Input } from "@/components/ui";
import { saveMailingAddressAction } from "./actions";

export function MailingAddressForm({ value }: { value: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(saveMailingAddressAction, undefined);
  return (
    <ActionForm action={action} className="space-y-2">
      <FormPopup state={state} savedText={t("Saved.")} />
      <Input name="mailing_address" defaultValue={value} placeholder={t("PO Box 123, Redwood City, CA 94063")} aria-label={t("Mailing address")} />
      <Button type="submit" kind="secondary" disabled={pending}>{pending ? t("Saving…") : t("Save address")}</Button>
    </ActionForm>
  );
}
