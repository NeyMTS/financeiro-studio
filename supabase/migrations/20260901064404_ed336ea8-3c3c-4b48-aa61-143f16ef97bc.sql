-- Restringe execução direta de funções SECURITY DEFINER

-- Função de trigger: nunca deve ser chamada diretamente
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- Função auxiliar: não é usada pelo app, só internamente
revoke execute on function public.is_household_member(uuid, uuid) from anon;
revoke execute on function public.is_household_member(uuid, uuid) from authenticated;

-- Funções chamadas pelo app: mantêm acesso para authenticated, removem anon
revoke execute on function public.create_household(text) from anon;
revoke execute on function public.join_household(text) from anon;

-- Garante que authenticated possa executar as funções necessárias
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
