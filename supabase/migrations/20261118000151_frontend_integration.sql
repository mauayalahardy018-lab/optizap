begin;

create type public.frame_segment as enum ('oftalmico', 'solar');
-- Existing rows stay unclassified; do not guess whether a frame is sunglasses.
alter table public.frames add column segment public.frame_segment;
create index frames_active_segment_price_idx on public.frames(segment, price, id) where is_active;

commit;
