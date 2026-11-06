"use client";
import { msg } from "@/lib/i18n";
import { useT } from "@/components/i18n";
import { useRef, useState, useTransition } from "react";
import { resizeImage } from "@/lib/resize-image";
import { removeLogoAction, saveLogoAction } from "../actions";

/** The business logo with "Change" and "Remove"; shrinks the picture on the phone first. */
export function LogoUpload({ src }: { src: string | null }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- small logo */}
      <img src={src ?? "/logo.png"} alt={t("Business logo")} width={80} height={80}
        className="h-20 w-20 shrink-0 rounded-full border border-line bg-white object-contain p-1" />
      <div className="space-y-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={t("Logo picture")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError(null);
            startTransition(async () => {
              try {
                const form = new FormData();
                // PNG keeps a transparent background.
                form.set("logo", await resizeImage(file, 600, 0.9, "image/png"), "logo.png");
                const res = await saveLogoAction(form);
                if (res.error) setError(res.error);
              } catch {
                setError(msg("Could not read that picture. Try another one."));
              }
            });
          }} />
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={pending}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-brand">
            {pending ? t("Saving…") : src ? t("Change logo") : t("Add logo")}
          </button>
          {src && (
            <button type="button" disabled={pending} onClick={() => startTransition(() => removeLogoAction())}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft">
              {t("Remove")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted">{t("Shows on your booking page, client links and receipts.")}</p>
        {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
      </div>
    </div>
  );
}
