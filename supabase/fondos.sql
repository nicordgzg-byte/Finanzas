-- Mis Finanzas: tabla de fondos (ahorros y fondo de emergencia)
-- Pega este archivo en Supabase > SQL Editor y dale "Run".
-- Si ya corriste schema.sql antes, solo necesitas este archivo.

create table if not exists public.fondos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre         text not null,
  saldo          numeric(12,2) not null default 0 check (saldo >= 0),
  meta           numeric(12,2) check (meta is null or meta > 0),
  es_emergencia  boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists fondos_user on public.fondos (user_id);

alter table public.fondos enable row level security;

drop policy if exists "fondos propios" on public.fondos;
create policy "fondos propios" on public.fondos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
