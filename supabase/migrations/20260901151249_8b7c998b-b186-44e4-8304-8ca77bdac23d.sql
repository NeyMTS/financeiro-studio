ALTER TABLE public.studio_clients
  ADD COLUMN IF NOT EXISTS birth_date date;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;

GRANT SELECT, INSERT, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_clients TO authenticated;
GRANT ALL ON public.studio_clients TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_services TO authenticated;
GRANT ALL ON public.studio_services TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_appointments TO authenticated;
GRANT ALL ON public.studio_appointments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

DROP POLICY IF EXISTS "Membros podem ver os membros da sua conta" ON public.household_members;
DROP POLICY IF EXISTS "Código de convite permite encontrar a conta" ON public.households;
DROP POLICY IF EXISTS "Criador pode atualizar sua conta compartilhada" ON public.households;
DROP POLICY IF EXISTS "Membros podem gerenciar contas da sua casa" ON public.accounts;
DROP POLICY IF EXISTS "Membros podem gerenciar metas da sua casa" ON public.goals;
DROP POLICY IF EXISTS "Membros podem gerenciar movimentações da sua casa" ON public.transactions;

CREATE POLICY "household members can update household"
ON public.households
FOR UPDATE
TO authenticated
USING (public.is_household_member(id, auth.uid()))
WITH CHECK (public.is_household_member(id, auth.uid()));

GRANT EXECUTE ON FUNCTION public.create_household(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_household(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_household(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) FROM anon;