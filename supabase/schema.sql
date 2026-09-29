-- Mis Finanzas: tablas y seguridad
-- Pega todo este archivo en Supabase > SQL Editor y dale "Run".

create table if not exists public.movimientos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('ingreso','egreso')),
  monto       numeric(12,2) not null check (monto > 0),
  concepto    text not null default '',
  categoria   text not null default 'Otro',
  fecha       date not null default current_date,
  created_at  timestamptz not null default now()
);

create table if not exists public.deudas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  acreedor      text not null,
  total         numeric(12,2) not null check (total > 0),
  pagado        numeric(12,2) not null default 0 check (pagado >= 0),
  fecha_limite  date,
  nota          text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists movimientos_user_fecha on public.movimientos (user_id, fecha desc);
create index if not exists deudas_user on public.deudas (user_id);

-- Cada persona solo ve y modifica sus propios registros
alter table public.movimientos enable row level security;
alter table public.deudas      enable row level security;

drop policy if exists "movimientos propios" on public.movimientos;
create policy "movimientos propios" on public.movimientos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "deudas propias" on public.deudas;
create policy "deudas propias" on public.deudas
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fondos (ahorros y fondo de emergencia)
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
