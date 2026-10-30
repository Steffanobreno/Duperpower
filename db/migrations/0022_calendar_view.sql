-- Calendar look (MoeGo "Calendar configuration"): what each visit shows, the hours the
-- day view always shows, and what colors the visits.
alter table businesses add column if not exists cal_show_client boolean not null default true;
alter table businesses add column if not exists cal_show_pets boolean not null default true;
alter table businesses add column if not exists cal_show_services boolean not null default true;
alter table businesses add column if not exists cal_show_address boolean not null default true;
alter table businesses add column if not exists cal_show_notes boolean not null default false;
alter table businesses add column if not exists cal_view_start time;   -- null = from working hours
alter table businesses add column if not exists cal_view_end time;
alter table businesses add column if not exists cal_color_by text not null default 'status'
  check (cal_color_by in ('status', 'staff', 'service'));
alter table services add column if not exists color text;
