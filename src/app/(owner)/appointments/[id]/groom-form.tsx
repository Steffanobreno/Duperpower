"use client";
import { useRef, useState, useTransition } from "react";
import { resizeImage } from "@/lib/resize-image";
import { saveGroomAction } from "../groom-actions";

// "This cut" for one pet on a visit: blade or comb, length/style, a note and a photo.
// "Same as last time" fills it from the previous visit.

type Cut = { blade: string | null; style: string | null; note: string | null };

const BLADES = ["#10", "#7F", "#5F", "#4F", "#3F", "#30 + 1/2\" comb", "#30 + 3/4\" comb", "#30 + 1\" comb", "Scissor cut", "Hand strip"];

export function GroomForm({ appointmentPetId, pet, now, last, photoUrl }: {
  appointmentPetId: string; pet: string; now: Cut | null; last: (Cut & { when: string; photoUrl: string | null }) | null; photoUrl: string | null;
}) {
  const [cut, setCut] = useState<Cut>(now ?? { blade: "", style: "", note: "" });
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
        if (photo) form.set("photo", photo, "cut.jpg");
        start(async () => {
          const res = await saveGroomAction(appointmentPetId, form);
          setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: "Saved ✓" });
          if (!res.error) setPhoto(null);
        });
      }}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">✂️ {pet}&apos;s cut</p>
        {last && (
          <button type="button" className="text-sm font-semibold text-brand"
            onClick={() => setCut({ blade: last.blade, style: last.style, note: last.note })}>
            Same as last time
          </button>
        )}
      </div>
      {last && (
        <div className="flex items-center gap-3 rounded-xl bg-brand-soft p-2 text-sm">
          {last.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a small private photo
            <img src={last.photoUrl} alt={`${pet} last time`} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          )}
          <p className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wide text-muted">Last time · {last.when}</span>
            {[last.blade, last.style].filter(Boolean).join(" · ") || "No blade noted"}
            {last.note && <span className="block text-muted">{last.note}</span>}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-medium" htmlFor={id("blade")}>Blade / comb
          <input id={id("blade")} list="blades" value={cut.blade ?? ""} onChange={(e) => setCut({ ...cut, blade: e.target.value })}
            className={field} placeholder="#7F" maxLength={60} />
        </label>
        <label className="text-sm font-medium" htmlFor={id("style")}>Length / style
          <input id={id("style")} value={cut.style ?? ""} onChange={(e) => setCut({ ...cut, style: e.target.value })}
            className={field} placeholder="Teddy face, 1/2&quot; legs" maxLength={120} />
        </label>
      </div>
      <datalist id="blades">{BLADES.map((b) => <option key={b} value={b} />)}</datalist>
      <label className="block text-sm font-medium" htmlFor={id("note")}>Note
        <textarea id={id("note")} value={cut.note ?? ""} onChange={(e) => setCut({ ...cut, note: e.target.value })}
          className={field} rows={2} maxLength={500} placeholder="Short around the eyes, leave the tail fluffy" />
      </label>
      <div className="flex items-center gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview or a small private photo
          <img src={preview} alt={`${pet} after the cut`} className="h-16 w-16 rounded-lg object-cover" />
        )}
        <input ref={file} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`Photo of ${pet}'s cut`}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const small = await resizeImage(f);
              setPhoto(small);
              setPreview(URL.createObjectURL(small));
            } catch {
              setMsg({ ok: false, text: "Could not read that photo. Try another one." });
            }
          }} />
        <button type="button" onClick={() => file.current?.click()}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-brand">
          📷 {preview ? "Change photo" : "Add photo"}
        </button>
        <button type="submit" disabled={pending} className="ml-auto rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
          {pending ? "Saving…" : "Save cut"}
        </button>
      </div>
      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
