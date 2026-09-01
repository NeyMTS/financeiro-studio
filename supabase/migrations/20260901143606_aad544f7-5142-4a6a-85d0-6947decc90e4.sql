-- 1. CLIENTES
CREATE TABLE public.studio_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_clients TO authenticated;
GRANT ALL ON public.studio_clients TO service_role;
ALTER TABLE public.studio_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "household clients access" ON public.studio_clients FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE INDEX studio_clients_household_idx ON public.studio_clients (household_id, name);
CREATE TRIGGER studio_clients_updated_at BEFORE UPDATE ON public.studio_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. SERVICOS
CREATE TABLE public.studio_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  default_price numeric NOT NULL DEFAULT 0,
  icon text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_services TO authenticated;
GRANT ALL ON public.studio_services TO service_role;
ALTER TABLE public.studio_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "household services access" ON public.studio_services FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE INDEX studio_services_household_idx ON public.studio_services (household_id, name);
CREATE TRIGGER studio_services_updated_at BEFORE UPDATE ON public.studio_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. AGENDAMENTOS
CREATE TABLE public.studio_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid REFERENCES public.studio_clients(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.studio_services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  deposit_amount numeric NOT NULL DEFAULT 0,
  received_amount numeric NOT NULL DEFAULT 0,
  scheduled_date date NOT NULL,
  scheduled_time time,
  status text NOT NULL DEFAULT 'agendado',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_appointments TO authenticated;
GRANT ALL ON public.studio_appointments TO service_role;
ALTER TABLE public.studio_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "household appointments access" ON public.studio_appointments FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE INDEX studio_appointments_household_date_idx ON public.studio_appointments (household_id, scheduled_date);
CREATE TRIGGER studio_appointments_updated_at BEFORE UPDATE ON public.studio_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. FINANCEIRO: colunas usadas pelo app
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.studio_appointments(id) ON DELETE CASCADE;

ALTER TABLE public.transactions ALTER COLUMN kind DROP NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN due_date DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_transaction_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- tipo
  IF NEW.type IS NULL AND NEW.kind IS NOT NULL THEN
    NEW.type := CASE WHEN NEW.kind IN ('entrada', 'income', 'receita') THEN 'income' ELSE 'expense' END;
  END IF;
  IF NEW.type IS NULL THEN NEW.type := 'income'; END IF;
  NEW.kind := CASE WHEN NEW.type = 'income' THEN 'entrada' ELSE 'gasto' END;

  -- data
  IF NEW.date IS NULL THEN NEW.date := COALESCE(NEW.due_date, CURRENT_DATE); END IF;
  NEW.due_date := NEW.date;

  -- status
  NEW.status := CASE
    WHEN NEW.status IN ('pending', 'aberto') THEN 'pending'
    ELSE 'paid'
  END;

  IF NEW.user_id IS NULL THEN NEW.user_id := NEW.created_by; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_sync_fields BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_fields();

UPDATE public.transactions SET description = description;

ALTER TABLE public.transactions ALTER COLUMN type SET DEFAULT 'income';
ALTER TABLE public.transactions ALTER COLUMN status SET DEFAULT 'paid';
CREATE INDEX IF NOT EXISTS transactions_household_date_idx ON public.transactions (household_id, date);

-- 5. AGENDAMENTO -> FINANCEIRO
CREATE OR REPLACE FUNCTION public.sync_appointment_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM public.transactions WHERE appointment_id = NEW.id LIMIT 1;

  IF COALESCE(NEW.received_amount, 0) <= 0 OR NEW.status = 'cancelado' THEN
    IF existing_id IS NOT NULL THEN
      DELETE FROM public.transactions WHERE id = existing_id;
    END IF;
    RETURN NEW;
  END IF;

  IF existing_id IS NULL THEN
    INSERT INTO public.transactions (
      household_id, created_by, user_id, appointment_id, description,
      amount, type, category, date, status, frequency
    ) VALUES (
      NEW.household_id, NEW.created_by, NEW.created_by, NEW.id,
      NEW.service_name, NEW.received_amount, 'income', 'Atendimento',
      NEW.scheduled_date, 'paid', 'avulsa'
    );
  ELSE
    UPDATE public.transactions
       SET amount = NEW.received_amount,
           description = NEW.service_name,
           date = NEW.scheduled_date,
           status = 'paid'
     WHERE id = existing_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER studio_appointments_sync_finance
  AFTER INSERT OR UPDATE ON public.studio_appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_transaction();