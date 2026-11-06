"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormPopup } from "@/components/popup";
import { useMoney, useRegion, useT } from "@/components/i18n";
import { Button, Field, Input } from "@/components/ui";
import { welcomeBusinessAction, welcomePricesAction } from "./actions";

/** Step 1: phone and address (all optional). */
export function BusinessStep({ initial }: { initial: { phone: string; address_line: string; city: string; zip: string } }) {
  const { t } = useT();
  const { country } = useRegion();
  const [state, action, pending] = useActionState(welcomeBusinessAction, undefined);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormPopup state={state} />
      <Field label={t("Business phone")} hint={t("Shown in texts and receipts.")}>
        <Input name="phone" type="tel" autoComplete="tel" defaultValue={initial.phone} />
      </Field>
      <Field label={t("Street")} hint={t("Shown on receipts. A mobile business can leave it empty.")}>
        <Input name="address_line" autoComplete="street-address" defaultValue={initial.address_line} />
      </Field>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label={t("City")}><Input name="city" defaultValue={initial.city} /></Field>
        <Field label={country === "US" ? t("ZIP code") : t("Postal code")}><Input name="zip" maxLength={10} defaultValue={initial.zip} /></Field>
      </div>
      <Button type="submit" className="w-full py-3.5 text-base" disabled={pending}>{pending ? t("Saving…") : t("Continue")}</Button>
    </ActionForm>
  );
}

export type PriceRow = { id: string; name: string; kind: "service" | "addon"; category: string | null; price_cents: number; active: boolean };

/** Step 2: one price box per service; add-ons can be switched off. */
export function PricesStep({ services }: { services: PriceRow[] }) {
  const { t } = useT();
  const money = useMoney();
  const [state, action, pending] = useActionState(welcomePricesAction, undefined);
  const groups = new Map<string, PriceRow[]>();
  for (const s of services) {
    const key = s.kind === "addon" ? t("Add-ons") : s.category || t("Services");
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  // The currency sign alone ("R$", "€"), from how zero is written.
  const symbol = money(0).replace(/[\d.,\s\u00a0]/g, "");
  const amount = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
  return (
    <ActionForm action={action} className="space-y-5">
      <FormPopup state={state} />
      {[...groups].map(([group, rows]) => (
        <fieldset key={group} className="space-y-2">
          <legend className="section-label">{group}</legend>
          <ul className="card divide-y divide-line overflow-hidden">
            {rows.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                {s.kind === "addon" && (
                  <input type="checkbox" name={`on:${s.id}`} defaultChecked={s.active} className="h-5 w-5 shrink-0"
                    aria-label={t("Offer {name}", { name: s.name })} />
                )}
                <span className="min-w-0 flex-1 text-sm font-medium">{s.name}</span>
                <label className="flex w-32 shrink-0 items-center gap-1.5">
                  <span aria-hidden className="text-sm text-muted">{symbol}</span>
                  <span className="sr-only">{t("Price of {name}", { name: s.name })}</span>
                  <Input name={`price:${s.id}`} inputMode="decimal" defaultValue={amount(s.price_cents)} className="text-right" />
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <p className="text-xs text-muted">{t("Change names, times and sizes later in Settings → Services and prices.")}</p>
      <Button type="submit" className="w-full py-3.5 text-base" disabled={pending}>{pending ? t("Saving…") : t("Continue")}</Button>
    </ActionForm>
  );
}
