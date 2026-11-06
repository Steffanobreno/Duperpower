-- How the business sizes dogs (by height or by weight) and the units it measures in.
-- Null units follow the country (inches and pounds in the US, cm and kg elsewhere).
alter table businesses add column if not exists size_by text not null default 'height'; -- height | weight
alter table businesses add column if not exists length_unit text;                       -- in | cm
alter table businesses add column if not exists weight_unit text;                       -- lb | kg
