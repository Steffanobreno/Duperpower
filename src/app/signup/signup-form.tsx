"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormPopup } from "@/components/popup";
import { Button, Field, Input, Select } from "@/components/ui";
import { TIMEZONES } from "@/lib/timezones";
import { signupAction } from "./actions";

// The phone's own time zone, when it's one we offer.
const guessZone = () => {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.some(([v]) => v === z) ? z : "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
};

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormPopup state={state} />
      <Field label="Business name"><Input name="business" required maxLength={80} placeholder="Happy Paws Mobile Grooming" /></Field>
      <Field label="Your name"><Input name="name" required maxLength={60} autoComplete="name" /></Field>
      <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
      <Field label="Password" hint="At least 10 characters."><Input name="password" type="password" required autoComplete="new-password" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Business phone"><Input name="phone" type="tel" autoComplete="tel" placeholder="(650) 555-0123" /></Field>
        <Field label="ZIP code"><Input name="zip" inputMode="numeric" maxLength={10} placeholder="94401" /></Field>
      </div>
      <Field label="Time zone">
        <Select name="timezone" defaultValue={guessZone()} suppressHydrationWarning>
          {TIMEZONES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </Select>
      </Field>
      {/* People never see this field; bots fill it in. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 accent-[var(--color-brand)]" />
        <span>I agree to the <Link href="/terms" className="font-semibold text-brand underline">terms</Link> and the{" "}
          <Link href="/privacy" className="font-semibold text-brand underline">privacy policy</Link>.</span>
      </label>
      <Button type="submit" className="w-full py-3.5 text-base" disabled={pending}>{pending ? "Creating your account…" : "Create my account"}</Button>
    </ActionForm>
  );
}
