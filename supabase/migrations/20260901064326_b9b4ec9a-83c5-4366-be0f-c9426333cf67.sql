-- Casal no Controle — schema inicial
-- Tabelas: profiles, households, household_members, accounts, transactions, goals
-- Funções: create_household, join_household, is_household_member

-- Perfil do usuário (display name, etc.)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Usuários podem ler seu próprio perfil"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Usuários podem atualizar seu próprio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Usuários podem criar seu próprio perfil"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Conta compartilhada do casal
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.households to authenticated;
grant all on public.households to service_role;

alter table public.households enable row level security;

create policy "Membros podem ver sua conta compartilhada"
  on public.households for select
  to authenticated
  using (
    exists (
      select 1 from public.household_members
      where household_id = households.id and user_id = auth.uid()
    )
  );

-- Associação usuário <-> conta compartilhada
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

grant select, insert, update, delete on public.household_members to authenticated;
grant all on public.household_members to service_role;

alter table public.household_members enable row level security;

create policy "Membros podem ver os membros da sua conta"
  on public.household_members for select
  to authenticated
  using (
    exists (
      select 1 from public.household_members as membership
      where membership.household_id = household_members.household_id
        and membership.user_id = auth.uid()
    )
  );

-- Contas financeiras (banco, carteira, cartão, etc.)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null default 'conta',
  initial_balance numeric(12,2) not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;

alter table public.accounts enable row level security;

create policy "Membros podem gerenciar contas da sua casa"
  on public.accounts for all
  to authenticated
  using (
    exists (
      select 1 from public.household_members
      where household_id = accounts.household_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members
      where household_id = accounts.household_id and user_id = auth.uid()
    )
  );

-- Movimentações (entradas e gastos)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  kind text not null default 'gasto',
  category text not null default 'Outros',
  due_date date not null,
  status text not null default 'aberto',
  frequency text not null default 'avulsa',
  recurring_value text,
  series_id uuid,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;

alter table public.transactions enable row level security;

create policy "Membros podem gerenciar movimentações da sua casa"
  on public.transactions for all
  to authenticated
  using (
    exists (
      select 1 from public.household_members
      where household_id = transactions.household_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members
      where household_id = transactions.household_id and user_id = auth.uid()
    )
  );

-- Metas financeiras do casal
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  target_amount numeric(12,2) not null,
  saved_amount numeric(12,2) not null default 0,
  due_date date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;

alter table public.goals enable row level security;

create policy "Membros podem gerenciar metas da sua casa"
  on public.goals for all
  to authenticated
  using (
    exists (
      select 1 from public.household_members
      where household_id = goals.household_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members
      where household_id = goals.household_id and user_id = auth.uid()
    )
  );

-- Função auxiliar: verifica se um usuário é membro de uma casa
CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.household_members
    where household_id = _household_id
      and user_id = _user_id
  );
$$;

-- Função: cria uma conta compartilhada e adiciona o usuário atual como membro
CREATE OR REPLACE FUNCTION public.create_household(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  new_household_id uuid;
  code text;
begin
  -- gera um código de convite único de 6 caracteres
  loop
    code := upper(substring(md5(random()::text) from 1 for 6));
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;

  insert into public.households (name, invite_code, created_by)
  values (_name, code, auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  return new_household_id;
end;
$$;

-- Função: entra em uma conta compartilhada via código de convite
CREATE OR REPLACE FUNCTION public.join_household(_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  target_household_id uuid;
begin
  select id into target_household_id
  from public.households
  where invite_code = upper(_invite_code)
  limit 1;

  if target_household_id is null then
    raise exception 'Código de convite inválido.';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  ) then
    return target_household_id;
  end if;

  insert into public.household_members (household_id, user_id)
  values (target_household_id, auth.uid());

  return target_household_id;
end;
$$;

-- Trigger: cria perfil automaticamente quando um usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
