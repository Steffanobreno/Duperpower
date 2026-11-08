-- One invite per client and day on Fill the gap: drop any duplicates (keeping the earliest), then
-- let the database refuse new ones, so two taps at once still record a single invite.
delete from fill_offers f
using fill_offers e
where e.business_id = f.business_id and e.client_id = f.client_id and e.day = f.day
  and (e.sent_at, e.id) < (f.sent_at, f.id);
create unique index if not exists fill_offers_one_per_day on fill_offers (business_id, client_id, day);
