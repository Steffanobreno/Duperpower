-- Agreement options: sign on every online booking (not just once a year), and a link per
-- client to sign without booking (the owner sends it by text or email).
alter table agreements add column if not exists sign_every_booking boolean not null default false;
alter table clients add column if not exists sign_token text unique default encode(gen_random_bytes(12), 'hex');
update clients set sign_token = encode(gen_random_bytes(12), 'hex') where sign_token is null;
alter table clients alter column sign_token set not null;
