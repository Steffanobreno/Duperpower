-- Report card: grooming tags on each cut, a public token and sent time on the visit, and its message template.
alter table pet_grooms add column if not exists tags text[] not null default '{}';
alter table appointments add column if not exists report_token text unique;
alter table appointments add column if not exists report_sent_at timestamptz;

drop table if exists grooming_reports;

alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check check (trigger in
  ('booked','request_received','request_accepted','request_declined',
   'reminder','reminder_2','confirmed','cancelled','on_my_way','thank_you','report',
   'rebook','review_request','feedback_positive','feedback_negative','vaccine_due','abandoned_booking',
   'report_card'));

insert into message_templates (business_id, trigger, body, email_subject, enabled, send_sms, send_email)
select b.id, 'report_card',
  'Hi {client}! Here is how {pet}''s visit went today, with photos: {report_url} Book the next one from there anytime. 🐾 {business}',
  '{pet}''s grooming report from {business}', false, false, true
from businesses b
where not exists (select 1 from message_templates t where t.business_id = b.id and t.trigger = 'report_card');
