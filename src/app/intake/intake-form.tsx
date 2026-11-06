"use client";
import { useActionState, useState } from "react";
import { useRegion, useT } from "@/components/i18n";
import { submitIntakeAction } from "./actions";

const input = "block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand focus:outline-none";
const SIZE_KEYS = [["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["xlarge", "X-Large"]] as const;

function Text({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input {...props} className={input} />
    </label>
  );
}

/** The new-client form: you, your address, up to three pets. */
export function IntakeForm({ bookUrl, slug = null }: { bookUrl: string; slug?: string | null }) {
  const { t, serverMessage } = useT();
  const { country } = useRegion();
  const [count, setCount] = useState(1);
  const [state, action, pending] = useActionState(submitIntakeAction, undefined);
  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-[28px] font-extrabold leading-tight">{t("Thank you! We got your info. 🐾")}</h1>
        <p className="text-muted">{t("Want to pick a time now?")}</p>
        <a href={bookUrl} className="block rounded-full bg-brand py-3.5 font-bold text-white">{t("Book a visit")}</a>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      {slug && <input type="hidden" name="slug" value={slug} />}
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{t("New client form")}</h1>
        <p className="mt-1 text-muted">{t("Tell us about you and your pets, so we're ready for the first visit.")}</p>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{serverMessage(state.error)}</p>}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <fieldset className="space-y-3">
        <legend className="mb-1 text-lg font-bold">{t("Your name")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <Text label={t("First name")} name="first_name" required autoComplete="given-name" />
          <Text label={t("Last name")} name="last_name" autoComplete="family-name" />
        </div>
        <Text label={t("Mobile phone")} name="phone" type="tel" required autoComplete="tel" inputMode="tel" />
        <Text label={t("Email address")} name="email" type="email" autoComplete="email" />
        <Text label={t("Street address")} name="address_line" autoComplete="street-address" />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Text label={t("City")} name="city" autoComplete="address-level2" />
          <Text label={country === "US" ? t("ZIP code") : t("Postal code")} name="zip" inputMode={country === "US" ? "numeric" : "text"} maxLength={country === "US" ? 5 : 10} autoComplete="postal-code" />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="sms_consent" defaultChecked className="mt-1 h-4 w-4" />
          <span>{t("I agree to receive text messages about my appointments.")}</span>
        </label>
      </fieldset>
      {Array.from({ length: count }, (_, i) => (
        <fieldset key={i} className="space-y-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-lg font-bold">{t("Your pets")}{count > 1 ? ` (${i + 1})` : ""}</legend>
          <Text label={t("Pet's name")} name={`pet_name:${i}`} required={i === 0} />
          <Text label={t("Breed")} name={`pet_breed:${i}`} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("Size")}</span>
            <select name={`pet_size:${i}`} className={input} defaultValue="">
              <option value="">—</option>
              {SIZE_KEYS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("Anything we should know? (health, behavior, coat)")}</span>
            <textarea name={`pet_notes:${i}`} rows={3} className={input} />
          </label>
        </fieldset>
      ))}
      {count < 3 && (
        <button type="button" onClick={() => setCount(count + 1)} className="font-semibold text-brand">+ {t("Add another pet")}</button>
      )}
      <button type="submit" disabled={pending} className="block w-full rounded-full bg-brand py-3.5 font-bold text-white disabled:opacity-60">
        {pending ? t("Sending…") : t("Send")}
      </button>
    </form>
  );
}
