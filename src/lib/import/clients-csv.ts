// Reads a client list: the old app's export (one row per client, pets as "Name(Breed),Name(Breed)"),
// a phone's or Google's contacts, or any spreadsheet with a name and a phone column, in English,
// Portuguese or Spanish, separated by commas, semicolons or tabs. Phones are read for the
// business's country. Pure parsing, no database, so the import page and the script share it.
import { toE164 } from "../countries";

export type ImportedPet = { name: string; breed: string | null };
export type ImportedClient = {
  row: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string; // E.164
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  notes: string[];
  marketing: boolean;
  pets: ImportedPet[];
  frequencyDays: number | null;
  lastService: { date: string; start: string } | null; // local business time
  next: { date: string; start: string; end: string } | null; // local business time
  upcomingCount: number;
  totalSalesCents: number | null;
};

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. `sep` is the separator. */
export function parseCsv(text: string, sep = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// The export pads values with tabs and non-breaking spaces.
const clean = (v: string | undefined) => (v ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

/** "Teddy(Miniature Poodle),Jax(Labradoodle (h))" → pets; commas inside parentheses are kept. */
export function parsePets(text: string): ImportedPet[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts
    .map((p) => clean(p))
    .filter(Boolean)
    .map((p) => {
      const open = p.indexOf("(");
      if (open < 0) return { name: p, breed: null };
      const name = clean(p.slice(0, open));
      const breed = clean(p.slice(open + 1, p.endsWith(")") ? -1 : undefined));
      return { name: name || p, breed: breed || null };
    });
}

/** "70 Peninsula Rd, Belvedere, CA, US, 94920" → parts. */
export function parseAddress(text: string) {
  const parts = clean(text).split(",").map((p) => p.trim()).filter(Boolean);
  let zip: string | null = null;
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) zip = parts.pop()!.slice(0, 5);
  if (parts.length && /^(US|USA|United States)$/i.test(parts[parts.length - 1])) parts.pop();
  let state: string | null = null;
  if (parts.length && /^[A-Z]{2}$/.test(parts[parts.length - 1])) state = parts.pop()!;
  const city = parts.length > 1 ? parts.pop()! : null;
  return { addressLine: parts.join(", ") || null, city, state, zip };
}

/** The separator a spreadsheet used: Excel in Brazil and Europe saves with semicolons. */
function separatorOf(text: string) {
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const count = (c: string) => first.split(c).length - 1;
  return [";", "\t", ","].reduce((best, c) => (count(c) > count(best) ? c : best), ",");
}

// Column names people use, compared without case or accents. The old app's names come first.
const COLUMNS = {
  first: ["first name", "firstname", "first", "given name", "primeiro nome", "nombre de pila"],
  last: ["last name", "lastname", "surname", "family name", "sobrenome", "ultimo nome", "apellido", "apellidos"],
  full: ["name", "full name", "client", "client name", "customer", "customer name", "owner", "owner name",
    "nome", "nome completo", "cliente", "nome do cliente", "tutor", "nombre", "nombre completo", "dueno"],
  email: ["email", "e-mail", "email address", "e-mail address", "e-mail 1 - value", "correo", "correo electronico"],
  phone: ["primary contact", "phone", "mobile", "phone number", "mobile phone", "cell", "cell phone", "telephone", "phone 1 - value",
    "whatsapp", "telefone", "celular", "telefono", "movil", "numero de telefono"],
  address: ["address", "street", "street address", "address 1", "endereco", "rua", "direccion", "calle"],
  city: ["city", "cidade", "ciudad", "municipio"],
  zip: ["zip", "zip code", "postal code", "postcode", "cep", "codigo postal", "cp"],
  pets: ["pet(breed)", "pets", "pet", "pet name", "pet names", "pet(s)", "dog", "dogs", "dog name",
    "nome do pet", "pet nome", "cachorro", "mascota", "mascotas", "nombre de la mascota", "perro"],
  breed: ["breed", "raca", "raza"],
  notes: ["notes", "note", "comments", "observacoes", "observacao", "notas", "nota", "comentarios"],
};
const fold = (s: string) => clean(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** "2026-10-21 19:00-22:00" → { date, start, end }. */
function parseSlot(text: string) {
  const m = clean(text).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?:-(\d{2}:\d{2}))?$/);
  return m ? { date: m[1], start: m[2], end: m[3] ?? m[2] } : null;
}

export function parseClientsCsv(text: string, country = "US") {
  const rows = parseCsv(text, separatorOf(text));
  if (rows.length < 2) return { clients: [] as ImportedClient[], problems: ["The file has no rows."] };
  const header = rows[0].map(fold);
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    first: col(...COLUMNS.first),
    last: col(...COLUMNS.last),
    full: col(...COLUMNS.full),
    email: col(...COLUMNS.email),
    phone: col(...COLUMNS.phone),
    address: col(...COLUMNS.address),
    city: col(...COLUMNS.city),
    zip: col(...COLUMNS.zip),
    pets: col(...COLUMNS.pets),
    breed: col(...COLUMNS.breed),
    sales: col("total sales"),
    lastService: col("last service"),
    next: col("next service"),
    notes: col(...COLUMNS.notes),
    marketing: col("has subscribed marketing email"),
    upcoming: col("upcoming booking number"),
    tags: col("tags"),
    frequency: col("preferred frequency (days)"),
    latlng: col("latitude, longitude of the address"),
  };
  if ((idx.first < 0 && idx.full < 0) || idx.phone < 0) {
    return { clients: [], problems: ['This file needs a name column and a phone column (for example "Name" and "Phone").'] };
  }

  const clients: ImportedClient[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const get = (j: number) => (j >= 0 ? clean(r[j]) : "");
    // One "Name" column: the first word is the first name, the rest the last name.
    const full = get(idx.full).split(" ");
    const firstName = idx.first >= 0 ? get(idx.first) : full[0] ?? "";
    const lastName = idx.first >= 0 ? get(idx.last) : idx.last >= 0 ? get(idx.last) : full.slice(1).join(" ");
    const phone = toE164(get(idx.phone), country);
    if (!firstName) return problems.push(`Row ${row}: no name, skipped.`);
    if (!phone) return problems.push(`Row ${row} (${firstName}): phone "${get(idx.phone)}" isn't a phone number for ${country}, skipped.`);
    if (seen.has(phone)) return problems.push(`Row ${row} (${firstName}): same phone as an earlier row, skipped.`);
    seen.add(phone);

    const [lat, lng] = get(idx.latlng).split(",").map((x) => Number(x.trim()));
    const sales = Number(get(idx.sales).replace(/[$,]/g, ""));
    const freq = Number(get(idx.frequency));
    const last = parseSlot(get(idx.lastService));
    const notes = [get(idx.notes), get(idx.tags) && `Tags: ${get(idx.tags)}`].filter(Boolean);
    // The address: the old app's one US line, or separate street, city and postal code columns.
    const address = country === "US" && idx.city < 0 && idx.zip < 0
      ? parseAddress(get(idx.address))
      : { addressLine: get(idx.address) || null, city: get(idx.city) || null, state: null, zip: get(idx.zip) || null };
    // A separate breed column belongs to the pet when there is one.
    const pets = parsePets(get(idx.pets));
    if (pets.length === 1 && !pets[0].breed && get(idx.breed)) pets[0].breed = get(idx.breed);
    clients.push({
      row,
      firstName,
      lastName,
      email: /^\S+@\S+\.\S+$/.test(get(idx.email)) ? get(idx.email).toLowerCase() : null,
      phone,
      ...address,
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
      notes,
      marketing: /^yes$/i.test(get(idx.marketing)),
      pets,
      frequencyDays: Number.isInteger(freq) && freq >= 7 && freq <= 365 ? freq : null,
      lastService: last ? { date: last.date, start: last.start } : null,
      next: parseSlot(get(idx.next)),
      upcomingCount: Number(get(idx.upcoming)) || 0,
      totalSalesCents: Number.isFinite(sales) && get(idx.sales) ? Math.round(sales * 100) : null,
    });
  });
  return { clients, problems };
}
