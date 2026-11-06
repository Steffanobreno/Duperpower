"use client";
import { useT } from "@/components/i18n";
import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormPopup } from "@/components/popup";
import { Button, Field, Input } from "@/components/ui";
import { CountryFields, type PlaceNames } from "@/components/country-fields";
import { currencyOf, mainZoneOf } from "@/lib/countries";
import { signupAction } from "./actions";

export function SignupForm({ country, names, source = "" }: { country: string; names: PlaceNames; source?: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormPopup state={state} />
      <Field label={t("Business name")}><Input name="business" required maxLength={80} placeholder={t("Happy Paws Mobile Grooming")} /></Field>
      <Field label={t("Your name")}><Input name="name" required maxLength={60} autoComplete="name" /></Field>
      <Field label={t("Email")}><Input name="email" type="email" required autoComplete="email" /></Field>
      <Field label={t("Password")} hint={t("At least 10 characters.")}><Input name="password" type="password" required autoComplete="new-password" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Business phone")}><Input name="phone" type="tel" autoComplete="tel" placeholder={country === "US" ? "(650) 555-0123" : ""} /></Field>
        <Field label={country === "US" ? t("ZIP code") : t("Postal code")}><Input name="zip" maxLength={10} placeholder={country === "US" ? "94401" : ""} /></Field>
      </div>
      <CountryFields country={country} currency={currencyOf(country)} timezone={mainZoneOf(country)} guess names={names} />
      <input type="hidden" name="source" value={source} />
      {/* People never see this field; bots fill it in. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 accent-[var(--color-brand)]" />
        <span>{t("I agree to the")}{" "} <Link href="/terms" className="font-semibold text-brand underline">{t("terms")}</Link> {" "}{t("and the")}{" "}
          <Link href="/privacy" className="font-semibold text-brand underline">{t("privacy policy")}</Link>.</span>
      </label>
      <Button type="submit" className="w-full py-3.5 text-base" disabled={pending}>{pending ? t("Creating your account…") : t("Create my account")}</Button>
    </ActionForm>
  );
}
