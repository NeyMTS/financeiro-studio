-- Torna create_household e join_household SECURITY INVOKER para eliminar
-- os alertas de SECURITY DEFINER acessível por usuários autenticados.

-- Políticas necessárias para SECURITY INVOKER funcionar

-- Usuário autenticado pode criar uma household desde que seja o created_by
create policy "Usuários autenticados podem criar sua conta compartilhada"
  on public.households for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Usuário autenticado pode atualizar o invite_code da própria conta (se necessário)
create policy "Criador pode atualizar sua conta compartilhada"
  on public.households for update
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.household_members
      where household_id = households.id and user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = created_by
    or exists (
      select 1 from public.household_members
      where household_id = households.id and user_id = auth.uid()
    )
  );

-- Usuário autenticado pode se adicionar como membro (user_id = auth.uid())
create policy "Usuários podem se associar à conta compartilhada"
  on public.household_members for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Política temporária para join_household encontrar a conta pelo convite
-- A variável de sessão app.invite_code só existe dentro da transação da função
create policy "Código de convite permite encontrar a conta"
  on public.households for select
  to authenticated
  using (
    invite_code = current_setting('app.invite_code', true)
    or exists (
      select 1 from public.household_members
      where household_id = households.id and user_id = auth.uid()
    )
  );

-- Remove a política antiga de select de households (será substituída)
drop policy if exists "Membros podem ver sua conta compartilhada" on public.households;

-- Recria create_household como SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.create_household(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
declare
  new_household_id uuid;
  code text;
begin
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

-- Recria join_household como SECURITY INVOKER, usando variável de sessão temporária
CREATE OR REPLACE FUNCTION public.join_household(_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
declare
  target_household_id uuid;
begin
  perform set_config('app.invite_code', upper(_invite_code), true);

  select id into target_household_id
  from public.households
  where invite_code = upper(_invite_code)
  limit 1;

  perform set_config('app.invite_code', '', true);

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

-- Revoga acesso público e garante apenas authenticated nas funções usadas pelo app
revoke execute on function public.create_household(text) from public;
revoke execute on function public.join_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
