"use client";
import { msg } from "@/lib/i18n";
import { useT } from "@/components/i18n";
import { useRef, useState, useTransition } from "react";
import { resizeImage } from "@/lib/resize-image";
import { removeStaffPhotoAction, saveStaffPhotoAction } from "./actions";

/** A team member's photo with "Add photo" / "Change photo" and "Remove"; shrinks it on the phone first. */
export function StaffPhotoUpload({ id, name, src }: { id: string; name: string; src: string | null }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="flex items-center gap-4">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- small photo from our own route
        <img src={src} alt={t("Photo of {name}", { name })} width={80} height={80} className="h-20 w-20 shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-on-brand">{initials}</span>
      )}
      <div className="space-y-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={t("Photo of {name}", { name })}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError(null);
            startTransition(async () => {
              try {
                const form = new FormData();
                form.set("photo", await resizeImage(file, 400, 0.85), "photo.jpg");
                const res = await saveStaffPhotoAction(id, form);
                if (res.error) setError(res.error);
              } catch {
                setError(msg("Could not read that picture. Try another one."));
              }
              if (input.current) input.current.value = "";
            });
          }} />
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={pending}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-brand">
            {pending ? t("Saving…") : src ? t("Change photo") : t("Add photo")}
          </button>
          {src && (
            <button type="button" disabled={pending} onClick={() => startTransition(() => removeStaffPhotoAction(id))}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft">
              {t("Remove")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted">{t("Clients see it on the booking page when they pick a time.")}</p>
        {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
      </div>
    </div>
  );
}
