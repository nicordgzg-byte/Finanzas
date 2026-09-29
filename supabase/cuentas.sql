-- Mis Finanzas: cuenta de cada movimiento (Efectivo, BBVA, Nu, etc.)
-- Pega este archivo en Supabase > SQL Editor y dale "Run".
alter table public.movimientos add column if not exists cuenta text;
