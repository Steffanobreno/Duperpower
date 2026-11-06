-- The help assistant: each question and answer (to limit use per business, and so the app
-- owner sees what people ask), and the "talk to a person" requests.
create table if not exists help_questions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  lang text not null,
  question text not null,
  answer text,
  helpful boolean,
  escalated boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists help_questions_business on help_questions (business_id, created_at desc);
create index if not exists help_questions_created on help_questions (created_at desc);
