-- Each message on or off per channel, a second reminder, the arrival window, and the receipt email switch.
alter table message_templates add column if not exists send_sms boolean not null default true;
alter table message_templates add column if not exists send_email boolean not null default true;

alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check check (trigger in
  ('booked','request_received','request_accepted','request_declined',
   'reminder','reminder_2','confirmed','cancelled','on_my_way','thank_you','report',
   'rebook','review_request','feedback_positive','feedback_negative','vaccine_due','abandoned_booking'));

insert into message_templates (business_id, trigger, body, email_subject, offset_days, send_at_time, enabled)
select b.id, 'reminder_2',
  'Hi {client}! See you tomorrow, {date}, at {time} for {pet}''s grooming with {business}. Need to change it? {link}',
  'See you tomorrow, {date}', 1, '10:00', false
from businesses b
where not exists (select 1 from message_templates t where t.business_id = b.id and t.trigger = 'reminder_2');

-- Arrival window: "10:00 AM" in messages becomes "10:00 AM – 10:45 AM" (mobile groomers can't promise the minute).
alter table businesses add column if not exists arrival_before_min int not null default 0 check (arrival_before_min between 0 and 240);
alter table businesses add column if not exists arrival_after_min int not null default 0 check (arrival_after_min between 0 and 240);
alter table businesses add column if not exists receipt_email_enabled boolean not null default true;
