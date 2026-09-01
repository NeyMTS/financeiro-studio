-- Financeiro Studio
-- Clientes, serviços e atendimentos

create table if not exists public.studio_clients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_services (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  default_price numeric(12,2) not null default 0,
  icon text not null default 'sparkles',
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_appointments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  client_id uuid not null references public.studio_clients(id) on delete restrict,
  service_id uuid references public.studio_services(id) on delete set null,

  service_name text not null,
  total_amount numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  received_amount numeric(12,2) not null default 0,

  scheduled_date date not null,
  scheduled_time time,

  status text not null default 'agendado',
  notes text,

  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint studio_appointments_amounts_check
    check (
      total_amount >= 0
      and deposit_amount >= 0
      and received_amount >= 0
      and deposit_amount <= total_amount
      and received_amount <= total_amount
    ),

  constraint studio_appointments_status_check
    check (
      status in (
        'agendado',
        'confirmado',
        'realizado',
        'cancelado'
      )
    )
);

create index if not exists studio_clients_household_idx
  on public.studio_clients(household_id);

create index if not exists studio_services_household_idx
  on public.studio_services(household_id);

create index if not exists studio_appointments_household_date_idx
  on public.studio_appointments(household_id, scheduled_date);

create index if not exists studio_appointments_client_idx
  on public.studio_appointments(client_id);


-- =========================================================
-- RLS
-- =========================================================

alter table public.studio_clients enable row level security;
alter table public.studio_services enable row level security;
alter table public.studio_appointments enable row level security;


create policy "Studio clients access"
on public.studio_clients
for all
to authenticated
using (
  public.is_household_member(studio_clients.household_id, auth.uid())
)
with check (
  public.is_household_member(studio_clients.household_id, auth.uid())
  and studio_clients.created_by = auth.uid()
);


create policy "Studio services access"
on public.studio_services
for all
to authenticated
using (
  public.is_household_member(studio_services.household_id, auth.uid())
)
with check (
  public.is_household_member(studio_services.household_id, auth.uid())
  and studio_services.created_by = auth.uid()
);


create policy "Studio appointments access"
on public.studio_appointments
for all
to authenticated
using (
  public.is_household_member(studio_appointments.household_id, auth.uid())
)
with check (
  public.is_household_member(studio_appointments.household_id, auth.uid())
  and studio_appointments.created_by = auth.uid()
);


grant select, insert, update, delete
on public.studio_clients
to authenticated;

grant select, insert, update, delete
on public.studio_services
to authenticated;

grant select, insert, update, delete
on public.studio_appointments
to authenticated;
