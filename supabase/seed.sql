-- Idempotent reference data only. Never seeds users, passwords or clinical data.
insert into public.brands(name, slug) values
  ('Ray-Ban', 'ray-ban'), ('Oakley', 'oakley'), ('Persol', 'persol'),
  ('Tom Ford', 'tom-ford'), ('Essilor', 'essilor'), ('ZEISS', 'zeiss')
on conflict (slug) do nothing;
