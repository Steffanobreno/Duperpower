import type { PetCode } from "@/lib/data/options";

/** A pet's colored codes (Matted, Biter…), small, for lists and visit pages. */
export function PetCodeChips({ codes }: { codes: PetCode[] | undefined }) {
  if (!codes?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {codes.map((c) => (
        <span key={c.id} title={c.description ?? undefined} className="rounded-full px-2 py-0.5 text-[11px] font-bold leading-4 text-white"
          style={{ background: c.color }}>
          {c.label}
        </span>
      ))}
    </span>
  );
}

/** Plain tags (client tags, behavior). */
export function TagChips({ tags }: { tags: string[] | undefined }) {
  if (!tags?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold leading-4 text-brand-strong">{t}</span>
      ))}
    </span>
  );
}
