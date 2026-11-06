import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getPet } from "@/lib/data/clients";
import { Card, Page, PageHeader } from "@/components/ui";
import { addVaccineAction, deletePetPriceAction, deleteVaccineAction, savePetAction, savePetPriceAction, setPetCodesAction, setPetPassedAction } from "../../../actions";
import { allOptions, listPetCodes, petCodesFor } from "@/lib/data/options";
import { petOptions } from "../../../options";
import Link from "next/link";
import { listServices } from "@/lib/data/services";
import { petPrices } from "@/lib/data/pet-prices";
import { PetPriceForm } from "./price-form";
import { listVaccines, SOON_DAYS } from "@/lib/data/vaccines";
import { addDaysYmd, dayLabel, minutesLabel, money, todayYmd } from "@/lib/format";
import { petGrooms } from "@/lib/data/grooms";
import { VaccineForm } from "./vaccine-form";
import { PetPhotoUpload } from "../../../pet-photo-upload";
import { PetPhoto } from "@/components/pet-photo";
import { PetForm } from "../../../forms";

export const metadata: Metadata = { title: "Edit pet" };

export default async function EditPetPage({ params }: PageProps<"/clients/[id]/pets/[petId]">) {
  const { t } = await getOwnerI18n();
  const staff = await requireStaff();
  const { id, petId } = await params;
  const [pet, vaccines, services, own, lists, codes, petCodes, grooms] = await Promise.all([
    getPet(staff, petId), listVaccines(staff, petId), listServices(staff), petPrices([petId]),
    allOptions(staff.businessId), listPetCodes(staff.businessId), petCodesFor([petId]), petGrooms(staff, petId),
  ]);
  const onPet = new Set((petCodes.get(petId) ?? []).map((c) => c.id));
  if (!pet || pet.client_id !== id) notFound();
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const custom = [...own.values()].filter((r) => serviceById.has(r.service_id));
  // Services for this pet's size first, then add-ons.
  const priceOptions = services.filter((s) => s.kind === "addon" || !s.size_class || !pet.size_class || s.size_class === pet.size_class)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "service" ? -1 : 1));
  const today = todayYmd(staff.timezone);
  const soon = addDaysYmd(today, SOON_DAYS);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  return (
    <>
      <PageHeader title={`Edit ${pet.name}`} back={`/clients/${id}`} />
      <Page>
        <Card className="flex items-center gap-4">
          <PetPhoto petId={petId} version={pet.photo_version} name={pet.name} size={88} />
          <PetPhotoUpload petId={petId} hasPhoto={!!pet.photo_version} />
        </Card>
        <Card className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold">{t("Pet codes")}</h2>
            <Link href="/settings/lists/pet-codes" className="text-sm font-semibold text-brand">{t("Edit codes")}</Link>
          </div>
          {codes.length ? (
            <form action={setPetCodesAction.bind(null, id, petId)} className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {codes.map((c) => (
                  <label key={c.id} className="cursor-pointer" title={c.description ?? undefined}>
                    <input type="checkbox" name="code" value={c.id} defaultChecked={onPet.has(c.id)} className="peer sr-only" />
                    <span className="block rounded-full border-2 border-[var(--c)] px-3 py-1 text-sm font-bold text-[var(--c)] peer-checked:bg-[var(--c)] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
                      style={{ ["--c" as string]: c.color }}>
                      {c.label}
                    </span>
                  </label>
                ))}
              </div>
              <button type="submit" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-brand">{t("Save codes")}</button>
            </form>
          ) : (
            <p className="text-sm text-muted">{t("No codes yet. Add some in Settings.")}</p>
          )}
        </Card>
        <Card>
          <PetForm action={savePetAction.bind(null, id, petId)} initial={pet} options={petOptions(lists)} />
        </Card>
        <Card className="space-y-3" id="prices">
          <div>
            <h2 className="font-bold">{t("{name}'s prices", { name: pet.name })}</h2>
            <p className="text-sm text-muted">
              {t("A price just for {name} (and, if you like, the time it takes). Booking uses it instead of the usual price, in the app and online.", { name: pet.name })}
            </p>
          </div>
          {custom.length > 0 && (
            <ul className="divide-y divide-line text-sm">
              {custom.map((r) => {
                const s = serviceById.get(r.service_id)!;
                return (
                  <li key={r.service_id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-semibold">{s.name}</span>
                      <span className="block text-xs text-muted">
                        {t("Usually {money}", { money: money(s.price_cents) })}{r.duration_min != null ? ` · ${minutesLabel(r.duration_min)} for ${pet.name}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-bold text-brand">{money(r.price_cents)}</span>
                      <form action={deletePetPriceAction.bind(null, id, petId, r.service_id)}>
                        <button type="submit" aria-label={`Remove ${pet.name}'s price for ${s.name}`} className="text-xs font-semibold text-danger">{t("Remove")}</button>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <PetPriceForm action={savePetPriceAction.bind(null, id, petId)} petName={pet.name} options={priceOptions} />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Grooming history")}</h2>
          {grooms.length === 0 ? (
            <p className="text-sm text-muted">{t("Nothing yet. On each visit, note the blade, the length and a photo under “How they were groomed”.")}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {grooms.map((g) => (
                <li key={g.id}>
                  <Link href={`/appointments/${g.appointment_id}`} className="flex items-center gap-3 py-2.5">
                    {g.has_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a small private photo
                      <img src={`/api/grooms/${g.id}/photo?v=${g.v}`} alt={`${pet.name} on ${dayLabel(g.day, staff.timezone)}`}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    ) : <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-bg text-xl">✂️</span>}
                    <span className="min-w-0">
                      <span className="block font-semibold">{dayLabel(g.day, staff.timezone)}</span>
                      <span className="block">{[g.blade, g.style].filter(Boolean).join(" · ") || "—"}</span>
                      {g.note && <span className="block truncate text-muted">{g.note}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Vaccines")}</h2>
          {vaccines.length === 0 ? (
            <p className="text-sm text-muted">{t("None on file yet. Add them from the certificate: you'll see a warning when one expires, and the client gets a reminder.")}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {vaccines.map((v) => {
                const state = !v.expires_on ? null : v.expires_on < today ? "expired" : v.expires_on <= soon ? "soon" : "ok";
                return (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{v.name}</span>
                      <span className="block text-xs text-muted">
                        {v.expires_on ? `Expires ${fmt(v.expires_on)}` : t("No expiry date")}{v.given_on ? ` · given ${fmt(v.given_on)}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {state && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${state === "expired" ? "bg-danger-soft text-danger" : state === "soon" ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
                          {state === "expired" ? t("Expired") : state === "soon" ? t("Expires soon") : t("Up to date")}
                        </span>
                      )}
                      <form action={deleteVaccineAction.bind(null, id, petId, v.id)}>
                        <button type="submit" aria-label={`Delete ${v.name}`} className="text-xs font-semibold text-danger">{t("Delete")}</button>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <VaccineForm action={addVaccineAction.bind(null, id, petId)} names={lists.vaccine.map((v) => v.label)} />
        </Card>
        <form action={setPetPassedAction.bind(null, id, petId, !pet.deceased_at)} className="text-center">
          <button type="submit" className="text-sm font-semibold text-muted underline">
            {pet.deceased_at ? `Undo: ${pet.name} is still with us` : `${pet.name} passed away 🌈`}
          </button>
          {!pet.deceased_at && <p className="mt-1 text-xs text-muted">{t("Hides {name} from booking and stops reminders. Visit history stays.", { name: pet.name })}</p>}
        </form>
      </Page>
    </>
  );
}
