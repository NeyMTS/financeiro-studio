DROP POLICY IF EXISTS "members can view membership" ON public.household_members;

CREATE POLICY "users can view own membership"
ON public.household_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

ALTER FUNCTION public.is_household_member(uuid, uuid) SECURITY INVOKER;