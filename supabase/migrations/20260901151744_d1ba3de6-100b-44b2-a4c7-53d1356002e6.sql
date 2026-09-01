CREATE OR REPLACE FUNCTION public.create_household(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_household_id uuid;
  code text;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuária não autenticada.';
  END IF;

  SELECT household_id
  INTO new_household_id
  FROM public.household_members
  WHERE user_id = current_user_id
  ORDER BY joined_at
  LIMIT 1;

  IF new_household_id IS NOT NULL THEN
    RETURN new_household_id;
  END IF;

  LOOP
    code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.households WHERE invite_code = code
    );
  END LOOP;

  INSERT INTO public.households (name, invite_code, created_by)
  VALUES (coalesce(nullif(trim(_name), ''), 'Studio Lary Andrade'), code, current_user_id)
  RETURNING id INTO new_household_id;

  INSERT INTO public.household_members (household_id, user_id)
  VALUES (new_household_id, current_user_id)
  ON CONFLICT (household_id, user_id) DO NOTHING;

  RETURN new_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_household(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_household(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_household(text) TO service_role;