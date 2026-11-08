"use client";
import { msg } from "@/lib/i18n";
import { useT } from "@/components/i18n";
import { useRef, useState, useTransition } from "react";
import { resizeImage } from "@/lib/resize-image";
import { GROOM_TAGS, GROOM_TAG_LABEL, type GroomTag } from "@/lib/groom-tags";
import { saveGroomAction } from "../groom-actions";

// "This cut" for one pet on a visit: blade or comb, length/style, a note and a photo.
// "Same as last time" fills it from the previous visit.

type Cut = { blade: string | null; style: string | null; note: string | null };

const BLADES = ["#10", "#7F", "#5F", "#4F", "#3F", "#30 + 1/2\" comb", "#30 + 3/4\" comb", "#30 + 1\" comb", msg("Scissor cut"), msg("Hand strip")];

export function GroomForm({ appointmentPetId, pet, now, tags: savedTags, last, photoUrl }: {
  appointmentPetId: string; pet: string; now: Cut | null; tags: string[]; last: (Cut & { when: string; photoUrl: string | null }) | null; photoUrl: string | null;
}) {
  const { t } = useT();
  const [cut, setCut] = useState<Cut>(now ?? { blade: "", style: "", note: "" });
  const [tags, setTags] = useState<string[]>(savedTags);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const field = "block w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none";
  const id = (k: string) => `${k}-${appointmentPetId}`;
  return (
    <form className="space-y-2 px-4 py-3" aria-label={`${pet}'s cut`}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData();
        form.set("blade", cut.blade ?? "");
        form.set("style", cut.style ?? "");
        form.set("note", cut.note ?? "");
        for (const k of tags) form.append("tag", k);
        if (photo) form.set("photo", photo, "cut.jpg");
        start(async () => {
          const res = await saveGroomAction(appointmentPetId, form);
          setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: t("Saved ✓") });
          if (!res.error) setPhoto(null);
        });
      }}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{t("✂️ {pet}'s cut", { pet: pet })}</p>
        {last && (
          <button type="button" className="text-sm font-semibold text-brand"
            onClick={() => setCut({ blade: last.blade, style: last.style, note: last.note })}>
            {t("Same as last time")}
          </button>
        )}
      </div>
      {last && (
        <div className="flex items-center gap-3 rounded-xl bg-brand-soft p-2 text-sm">
          {last.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a small private photo
            <img src={last.photoUrl} alt={t("{pet} last time", { pet })} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          )}
          <p className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wide text-muted">{t("Last time · {when}", { when: last.when })}</span>
            {[last.blade, last.style].filter(Boolean).join(" · ") || t("No blade noted")}
            {last.note && <span className="block text-muted">{last.note}</span>}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-medium" htmlFor={id("blade")}>{t("Blade / comb")}
          <input id={id("blade")} list="blades" value={cut.blade ?? ""} onChange={(e) => setCut({ ...cut, blade: e.target.value })}
            className={field} placeholder="#7F" maxLength={60} />
        </label>
        <label className="text-sm font-medium" htmlFor={id("style")}>{t("Length / style")}
          <input id={id("style")} value={cut.style ?? ""} onChange={(e) => setCut({ ...cut, style: e.target.value })}
            className={field} placeholder={t("Teddy face, 1/2\" legs")} maxLength={120} />
        </label>
      </div>
      <datalist id="blades">{BLADES.map((b) => <option key={b} value={b} />)}</datalist>
      <label className="block text-sm font-medium" htmlFor={id("note")}>{t("Note")}
        <textarea id={id("note")} value={cut.note ?? ""} onChange={(e) => setCut({ ...cut, note: e.target.value })}
          className={field} rows={2} maxLength={500} placeholder={t("Short around the eyes, leave the tail fluffy")} />
      </label>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{t("Tags")}</legend>
        {GROOM_TAGS.map((k: GroomTag) => (
          <label key={k} className="cursor-pointer">
            <input type="checkbox" name="tag" value={k} className="peer sr-only" checked={tags.includes(k)}
              onChange={(e) => setTags(e.target.checked ? [...tags, k] : tags.filter((x) => x !== k))} />
            <span className="block rounded-full border border-line px-3 py-1.5 text-sm peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
              {t(GROOM_TAG_LABEL[k])}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview or a small private photo
          <img src={preview} alt={t("{pet} after the cut", { pet })} className="h-16 w-16 rounded-lg object-cover" />
        )}
        <input ref={file} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={t("Photo of {pet}'s cut", { pet })}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const small = await resizeImage(f);
              setPhoto(small);
              setPreview(URL.createObjectURL(small));
            } catch {
              setMsg({ ok: false, text: t("Could not read that photo. Try another one.") });
            }
          }} />
        <button type="button" onClick={() => file.current?.click()}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-brand">
          📷 {preview ? t("Change photo") : t("Add photo")}
        </button>
        <button type="submit" disabled={pending} className="ml-auto rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          {pending ? t("Saving…") : t("Save cut")}
        </button>
      </div>
      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
