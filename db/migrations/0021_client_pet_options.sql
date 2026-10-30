-- The owner's own lists for clients and pets (MoeGo "Clients & pets settings"):
-- client tags, referral sources, coat types, behaviors, vaccines and extra breeds.
create table if not exists option_lists (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('client_tag','referral_source','coat_type','behavior','vaccine','breed')),
  label text not null check (char_length(label) between 1 and 60),
  sort_order int not null default 0,
  unique (business_id, kind, label)
);
alter table option_lists enable row level security;
-- The defaults go in once; after that, removing every item leaves the list empty.
alter table businesses add column if not exists options_seeded boolean not null default false;

-- Tags are saved as text so renaming or removing a list item never touches a client.
create table if not exists client_tags (
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  primary key (client_id, label)
);
alter table client_tags enable row level security;
alter table clients add column if not exists referral_source text;

alter table pets add column if not exists behavior_tags text[] not null default '{}';
alter table pet_codes add column if not exists sort_order int not null default 0;
alter table pet_codes enable row level security;
alter table pet_pet_codes enable row level security;
