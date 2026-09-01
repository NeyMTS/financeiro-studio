-- Remove o acesso público padrão das funções SECURITY DEFINER
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_household_member(uuid, uuid) from public;
revoke execute on function public.create_household(text) from public;
revoke execute on function public.join_household(text) from public;

-- Garante acesso apenas para authenticated nas funções usadas pelo app
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- Garante acesso para service_role em todas
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.is_household_member(uuid, uuid) to service_role;
grant execute on function public.create_household(text) to service_role;
grant execute on function public.join_household(text) to service_role;
