-- The road path of the day's route (Google's encoded polyline), to draw it on the Today map,
-- and which geocoder placed each visit, so visits placed by the free Census geocoder are
-- placed again with Google once its key is set.
alter table route_cache add column if not exists polyline text;
alter table appointments add column if not exists geocoded_by text;
