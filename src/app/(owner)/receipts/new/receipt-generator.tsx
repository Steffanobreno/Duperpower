"use client";
import { useT } from "@/components/i18n";
import { DateField } from "@/components/date-field";
import { useMemo, useState, useTransition } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Close, Plus } from "@/components/icons";
import { money } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { createReceiptAction } from "../actions";

type Client = { id: string; name: string; email: string | null };
type Pet = { id: string; client_id: string; name: string; size_class: string | null };
type Service = { id: string; name: string; kind: "service" | "addon"; size: string | null; priceCents: number };
type Line = { key: number; petId: string; serviceId: string; name: string; price: string };

let nextKey = 0;
const toCents = (s: string) => Math.round(Number(s.replace(/[$,\s]/g, "") || 0) * 100);

export function ReceiptGenerator({ clients, pets, services, ownPrices, today, defaultClient }: {
  clients: Client[];
  pets: Pet[];
  services: Service[];
  ownPrices: { pet_id: string; service_id: string; price_cents: number }[];
  today: string;
  defaultClient: string;
}) {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState(clients.some((c) => c.id === defaultClient) ? defaultClient : "");
  const [lines, setLines] = useState<Line[]>([]);
  const [date, setDate] = useState(today);
  const [checkIn, setCheckIn] = useState("10:00");
  const [checkOut, setCheckOut] = useState("12:00");
  const [method, setMethod] = useState("cash");
  const [tip, setTip] = useState("");
  const [email, setEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const client = clients.find((c) => c.id === clientId);
  const found = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8) : [];
  }, [search, clients]);
  const clientPets = pets.filter((p) => p.client_id === clientId);
  const priceFor = (petId: string, s: Service) =>
    ownPrices.find((o) => o.pet_id === petId && o.service_id === s.id)?.price_cents ?? s.priceCents;
  const servicesCents = lines.reduce((s, l) => s + toCents(l.price), 0);
  const tipCents = toCents(tip);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await createReceiptAction({
        clientId,
        lines: lines.map((l) => ({ petId: l.petId, serviceId: l.serviceId, priceCents: toCents(l.price) })),
        date, checkIn, checkOut, method, tipCents, email: email && !!client?.email,
      });
      if (res?.error) setError(res.error);
    });

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <h2 className="font-bold">{t("1. Client")}</h2>
        {client ? (
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{client.name}</span>
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => { setClientId(""); setLines([]); }}>{t("Change")}</button>
          </div>
        ) : (
          <>
            <Input aria-label={t("Search clients")} placeholder={t("Type the client's name")} value={search} onChange={(e) => setSearch(e.target.value)} />
            <ul className="divide-y divide-line">
              {found.map((c) => (
                <li key={c.id}>
                  <button type="button" className="w-full py-2.5 text-left font-semibold" onClick={() => { setClientId(c.id); setSearch(""); }}>
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {client && (
        <section className="card space-y-3 p-4">
          <h2 className="font-bold">{t("2. Dog and services")}</h2>
          {clientPets.length === 0 && <Notice kind="warn">{t("This client has no pets. Add one on their profile first.")}</Notice>}
          {clientPets.map((p) => {
            const mine = lines.filter((l) => l.petId === p.id);
            const options = services.filter((s) => s.kind === "addon" || !s.size || !p.size_class || s.size === p.size_class);
            return (
              <div key={p.id} className="space-y-2 rounded-xl border border-line p-3">
                <p className="font-bold">{p.name}</p>
                {mine.map((l) => (
                  <div key={l.key} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm">{l.name}</span>
                    <span className="flex items-center gap-1">$
                      <input inputMode="decimal" aria-label={t("Price of {name} for {name2}", { name: l.name, name2: p.name })} value={l.price}
                        onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, price: e.target.value } : x)))}
                        className="w-20 rounded-lg border border-line px-2 py-1.5 text-right" />
                    </span>
                    <button type="button" aria-label={t("Remove {name}", { name: l.name })} onClick={() => setLines(lines.filter((x) => x.key !== l.key))}
                      className="rounded-full border-2 border-danger p-0.5 text-danger"><Close size={12} strokeWidth={3} /></button>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-brand">
                  <Plus size={16} />
                  <select aria-label={t("Add a service for {name}", { name: p.name })} value="" className="w-0 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    onChange={(e) => {
                      const s = services.find((x) => x.id === e.target.value);
                      if (s) setLines([...lines, { key: nextKey++, petId: p.id, serviceId: s.id, name: s.name, price: (priceFor(p.id, s) / 100).toString() }]);
                    }}>
                    <option value="">{t("Add a service")}</option>
                    {options.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(priceFor(p.id, s))}</option>)}
                  </select>
                </label>
              </div>
            );
          })}
        </section>
      )}

      {client && (
        <section className="card space-y-3 p-4">
          <h2 className="font-bold">{t("3. When and how they paid")}</h2>
          <Field label={t("Date of the visit")}><DateField value={date} onChange={setDate} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Check-in")}><Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></Field>
            <Field label={t("Check-out")}><Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
          </div>
          <Field label={t("Paid with")}>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}
            </Select>
          </Field>
          <Field label={t("Tip (leave empty for no tip)")}>
            <Input inputMode="decimal" placeholder="$0.00" value={tip} onChange={(e) => setTip(e.target.value)} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={email && !!client.email} disabled={!client.email} onChange={(e) => setEmail(e.target.checked)} className="h-4 w-4" />
            {client.email ? t("Email it to {email}", { email: client.email }) : t("No email on file (you can share the PDF after)")}
          </label>
        </section>
      )}

      {client && (
        <div className="card space-y-1 px-4 py-3">
          <p className="flex justify-between"><span className="text-muted">{t("Services")}</span><span>{money(servicesCents)}</span></p>
          <p className="flex justify-between"><span className="text-muted">{t("Tip")}</span><span>{money(tipCents)}</span></p>
          <p className="flex justify-between text-lg font-bold"><span>{t("Total paid")}</span><span>{money(servicesCents + tipCents)}</span></p>
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {client && (
        <Button className="w-full py-3.5 text-base" disabled={pending || lines.length === 0} onClick={submit}>
          {pending ? t("Making the receipt…") : t("Make receipt")}
        </Button>
      )}
    </div>
  );
}
