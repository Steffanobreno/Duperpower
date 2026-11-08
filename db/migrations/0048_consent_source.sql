-- Where each client's text-message consent came from. Consent that existed before this column
-- is marked 'legacy' (we cannot say how it was collected).
alter table clients add column if not exists sms_consent_source text
  check (sms_consent_source in ('booking', 'intake', 'manual', 'import_attested', 'legacy'));
update clients set sms_consent_source = 'legacy' where sms_consent_at is not null and sms_consent_source is null;
