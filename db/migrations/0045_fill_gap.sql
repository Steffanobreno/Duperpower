-- Fill the gap: who was invited to a free day (the screen shows "Invited today", the KPI panel
-- counts invites that became visits), and the gap offer message the owner sends by hand.
create table if not exists fill_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now()
);
create index if not exists fill_offers_business_day on fill_offers (business_id, day);
alter table fill_offers enable row level security;

alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check check (trigger in
  ('booked','request_received','request_accepted','request_declined',
   'reminder','reminder_2','confirmed','cancelled','on_my_way','thank_you','report',
   'rebook','review_request','feedback_positive','feedback_negative','vaccine_due','abandoned_booking',
   'report_card','gap_offer'));

insert into message_templates (business_id, trigger, body, send_sms, send_email)
select b.id, 'gap_offer',
  'Hi {client}! I''ll be near you on {day}. I have an opening at {time} for {pet}. Want it? {booking_url}',
  false, false
from businesses b
where not exists (select 1 from message_templates t where t.business_id = b.id and t.trigger = 'gap_offer');
