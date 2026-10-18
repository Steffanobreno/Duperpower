// Writes parsed clients into the database. Takes the connection as a parameter so the
// import page (app pool) and the command-line script (own connection) can both use it.
import type { Sql } from "postgres";
import { fromZonedTime } from "date-fns-tz";
import type { ImportedClient } from "./clients-csv";

export type ImportReport = {
  created: number;
  existing: number;
  pets: number;
  appointments: number;
  problems: string[];
  moreUpcoming: string[]; // clients with more than one upcoming visit: only the next one comes over
};

export async function writeClients(
  sql: Sql,
  target: { businessId: string; staffId: string; timezone: string },
  clients: ImportedClient[],
  options: { appointments: boolean },
): Promise<ImportReport> {
  const report: ImportReport = { created: 0, existing: 0, pets: 0, appointments: 0, problems: [], moreUpcoming: [] };
  const local = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, target.timezone);
  const now = Date.now();

  for (const c of clients) {
    const label = `${c.firstName} ${c.lastName}`.trim();
    try {
      await sql.begin(async (tx) => {
        const [found] = await tx`select id from clients where business_id = ${target.businessId} and phone = ${c.phone}`;
        if (found) {
          report.existing++;
          return;
        }
        // They already received texts from the business in the old app, so text consent carries over.
        const [client] = await tx`
          insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip, lat, lng,
                               marketing_opt_in, sms_consent_at, source, imported_last_service_at, imported_total_sales_cents)
          values (${target.businessId}, ${c.firstName}, ${c.lastName}, ${c.phone}, ${c.email}, ${c.addressLine}, ${c.city},
                  ${c.state}, ${c.zip}, ${c.lat}, ${c.lng}, ${c.marketing}, now(), 'import',
                  ${c.lastService ? local(c.lastService.date, c.lastService.start) : null}, ${c.totalSalesCents})
          returning id`;
        report.created++;
        for (const note of c.notes) {
          await tx`insert into client_notes (client_id, staff_id, body) values (${client.id}, ${target.staffId}, ${note})`;
        }
        const petIds: string[] = [];
        for (const p of c.pets) {
          const [pet] = await tx`
            insert into pets (client_id, name, breed, rebook_every_days)
            values (${client.id}, ${p.name.slice(0, 80)}, ${p.breed?.slice(0, 120) ?? null}, ${c.frequencyDays})
            returning id`;
          petIds.push(pet.id);
          report.pets++;
        }

        if (options.appointments && c.next) {
          const start = local(c.next.date, c.next.start);
          let end = local(c.next.date, c.next.end);
          if (end <= start) end = new Date(start.getTime() + 120 * 60_000);
          if (start.getTime() > now) {
            // Savepoint: a clash with another imported visit must not undo the client.
            try {
              await tx.savepoint(async (sp) => {
                const [appt] = await sp`
                  insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, source,
                                            address_line, zip, lat, lng, notes)
                  values (${target.businessId}, ${client.id}, ${target.staffId}, ${start}, ${end}, 'unconfirmed', 'manual',
                          ${[c.addressLine, c.city, c.state].filter(Boolean).join(", ") || null}, ${c.zip}, ${c.lat}, ${c.lng},
                          'Imported from the old app. Check the pets and add the services before checkout.')
                  returning id`;
                for (const petId of petIds) {
                  await sp`insert into appointment_pets (appointment_id, pet_id) values (${appt.id}, ${petId})`;
                }
              });
              report.appointments++;
              if (c.upcomingCount > 1) report.moreUpcoming.push(`${label} (${c.upcomingCount} upcoming)`);
            } catch (e) {
              const code = (e as { code?: string }).code;
              report.problems.push(
                code === "23P01"
                  ? `${label}: the visit on ${c.next.date} ${c.next.start} overlaps another one; add it by hand.`
                  : `${label}: could not import the visit on ${c.next.date}.`,
              );
            }
          }
        }
      });
    } catch (e) {
      report.problems.push(`Row ${c.row} (${label}): not imported (${(e as Error).message.slice(0, 120)}).`);
    }
  }
  return report;
}
