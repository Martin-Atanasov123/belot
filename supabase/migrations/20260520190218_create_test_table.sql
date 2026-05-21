-- Test table to demonstrate CLI capabilities
create table if not exists public.test_demo (
  id bigint primary key generated always as identity,
  name text not null,
  description text,
  created_at timestamp with time zone default now()
);

-- RLS policies
alter table public.test_demo enable row level security;

create policy "Allow all to read test_demo"
  on public.test_demo
  for select
  using (true);

create policy "Allow all to insert test_demo"
  on public.test_demo
  for insert
  with check (true);

-- Insert sample data
insert into public.test_demo (name, description) values
  ('Тест 1', 'Първото тестово съобщение'),
  ('Тест 2', 'Второто тестово съобщение'),
  ('Тест 3', 'Третото тестово съобщение');
