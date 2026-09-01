-- Financeiro Studio
-- Corrige a criação de registros e reforça o isolamento por household.

-- =========================================================
-- ACCOUNTS
-- =========================================================

drop policy if exists "Membros podem gerenciar contas da sua casa"
on public.accounts;

create policy "Membros podem gerenciar contas da sua casa"
on public.accounts
for all
to authenticated
using (
  public.is_household_member(accounts.household_id, auth.uid())
)
with check (
  public.is_household_member(accounts.household_id, auth.uid())
  and accounts.created_by = auth.uid()
);


-- =========================================================
-- TRANSACTIONS
-- =========================================================

drop policy if exists "Membros podem gerenciar movimentações da sua casa"
on public.transactions;

create policy "Membros podem gerenciar movimentações da sua casa"
on public.transactions
for all
to authenticated
using (
  public.is_household_member(transactions.household_id, auth.uid())
)
with check (
  public.is_household_member(transactions.household_id, auth.uid())
  and transactions.created_by = auth.uid()
);


-- =========================================================
-- GOALS
-- =========================================================

drop policy if exists "Membros podem gerenciar metas da sua casa"
on public.goals;

create policy "Membros podem gerenciar metas da sua casa"
on public.goals
for all
to authenticated
using (
  public.is_household_member(goals.household_id, auth.uid())
)
with check (
  public.is_household_member(goals.household_id, auth.uid())
  and goals.created_by = auth.uid()
);
