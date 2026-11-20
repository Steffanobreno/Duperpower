-- Tenant isolation in the database itself: a row can only point to rows of its own business.
-- The app already filters every query by the logged-in business; these triggers are the second
-- lock: if a bug (or a forged form) ever tries to link a visit to another business's client, a
-- pet to another business's visit, a payment to another business's bill…, the database refuses.
-- They run only on writes (insert, or an update of the linking columns), so reading costs nothing.

-- The business a row belongs to (pets through their client). Null when the row doesn't exist.
create or replace function app_business_of(tbl text, rid uuid) returns uuid
language sql stable as $$
  select case tbl
    when 'clients' then (select business_id from clients where id = rid)
    when 'appointments' then (select business_id from appointments where id = rid)
    when 'staff' then (select business_id from staff where id = rid)
    when 'services' then (select business_id from services where id = rid)
    when 'invoices' then (select business_id from invoices where id = rid)
    when 'pets' then (select c.business_id from pets p join clients c on c.id = p.client_id where p.id = rid)
    when 'appointment_pets' then (select a.business_id from appointment_pets ap join appointments a on a.id = ap.appointment_id where ap.id = rid)
  end
$$;

-- Arguments: pairs of (column, table) this row points to. A row with its own business_id must
-- point to rows of that business; a row without one must point to rows of a single business.
create or replace function app_same_business() returns trigger
language plpgsql as $$
declare
  row jsonb := to_jsonb(new);
  own uuid := (row ->> 'business_id')::uuid;
  seen uuid := own;
  other uuid;
  i int := 0;
begin
  while i < tg_nargs loop
    if row ->> tg_argv[i] is not null then
      other := app_business_of(tg_argv[i + 1], (row ->> tg_argv[i])::uuid);
      if other is not null then
        if seen is null then
          seen := other;
        elsif other <> seen then
          raise exception 'cross-business link refused: %.% points to another business', tg_table_name, tg_argv[i]
            using errcode = '42501';
        end if;
      end if;
    end if;
    i := i + 2;
  end loop;
  return new;
end
$$;

-- Rows that carry their own business_id.
drop trigger if exists same_business on appointments;
create trigger same_business before insert or update of business_id, client_id, staff_id on appointments
  for each row execute function app_same_business('client_id', 'clients', 'staff_id', 'staff');
drop trigger if exists same_business on invoices;
create trigger same_business before insert or update of business_id, client_id, appointment_id on invoices
  for each row execute function app_same_business('client_id', 'clients', 'appointment_id', 'appointments');
drop trigger if exists same_business on messages;
create trigger same_business before insert or update of business_id, client_id, appointment_id on messages
  for each row execute function app_same_business('client_id', 'clients', 'appointment_id', 'appointments');
drop trigger if exists same_business on booking_drafts;
create trigger same_business before insert or update of business_id, client_id on booking_drafts
  for each row execute function app_same_business('client_id', 'clients');
drop trigger if exists same_business on fill_offers;
create trigger same_business before insert or update of business_id, client_id on fill_offers
  for each row execute function app_same_business('client_id', 'clients');
drop trigger if exists same_business on intake_submissions;
create trigger same_business before insert or update of business_id, client_id on intake_submissions
  for each row execute function app_same_business('client_id', 'clients');
drop trigger if exists same_business on waitlist;
create trigger same_business before insert or update of business_id, client_id on waitlist
  for each row execute function app_same_business('client_id', 'clients');
drop trigger if exists same_business on help_questions;
create trigger same_business before insert or update of business_id, staff_id on help_questions
  for each row execute function app_same_business('staff_id', 'staff');
drop trigger if exists same_business on push_subscriptions;
create trigger same_business before insert or update of business_id, staff_id on push_subscriptions
  for each row execute function app_same_business('staff_id', 'staff');
drop trigger if exists same_business on service_areas;
create trigger same_business before insert or update of business_id, staff_id on service_areas
  for each row execute function app_same_business('staff_id', 'staff');

-- Rows that join two others: both ends in the same business.
drop trigger if exists same_business on appointment_pets;
create trigger same_business before insert or update on appointment_pets
  for each row execute function app_same_business('appointment_id', 'appointments', 'pet_id', 'pets');
drop trigger if exists same_business on appointment_services;
create trigger same_business before insert or update on appointment_services
  for each row execute function app_same_business('appointment_pet_id', 'appointment_pets', 'service_id', 'services');
drop trigger if exists same_business on pet_service_prices;
create trigger same_business before insert or update on pet_service_prices
  for each row execute function app_same_business('pet_id', 'pets', 'service_id', 'services');
drop trigger if exists same_business on client_notes;
create trigger same_business before insert or update on client_notes
  for each row execute function app_same_business('client_id', 'clients', 'staff_id', 'staff');
drop trigger if exists same_business on payments;
create trigger same_business before insert or update on payments
  for each row execute function app_same_business('invoice_id', 'invoices', 'staff_id', 'staff');
