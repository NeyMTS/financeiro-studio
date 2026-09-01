import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  LogOut,
  MoreVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { useHousehold } from "@/hooks/use-household";
import { MonthSelect, useMonthSelection } from "@/components/MonthSelect";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate, monthLabel, monthRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Financeiro Studio" },
      {
        name: "description",
        content: "Controle financeiro simples e organizado.",
      },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: household } = useHousehold();

  const {
    options: monthOpts,
    selected: month,
    setSelected: setMonth,
    date: now,
  } = useMonthSelection();

  const { start, end } = monthRange(now);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", "month", household?.id, start],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, description, amount, kind, category, due_date, status"
        )
        .eq("household_id", household!.id)
        .gte("due_date", start)
        .lte("due_date", end)
        .order("due_date", { ascending: true });

      if (error) throw error;

      return data ?? [];
    },
  });

  const rows = transactions ?? [];

  const income = rows
    .filter(
      (transaction) =>
        transaction.kind === "entrada" &&
        transaction.status === "pago"
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const expense = rows
    .filter(
      (transaction) =>
        transaction.kind === "gasto" &&
        transaction.status === "pago"
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const balance = income - expense;

  const pendingIncome = rows
    .filter(
      (transaction) =>
        transaction.kind === "entrada" &&
        transaction.status === "aberto"
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const pendingExpenses = rows
    .filter(
      (transaction) =>
        transaction.kind === "gasto" &&
        transaction.status === "aberto"
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const openTransactions = rows
    .filter((transaction) => transaction.status === "aberto")
    .sort((a, b) =>
      String(a.due_date).localeCompare(String(b.due_date))
    );

  async function handleSignOut() {
    queryClient.clear();

    await supabase.auth.signOut();

    navigate({
      to: "/auth",
      replace: true,
    });
  }

  return (
    <AppShell
      title="Financeiro"
      subtitle={monthLabel(now)}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Mais opções"
            className="rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreVertical className="size-4" strokeWidth={1.6} />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="mr-2 size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <section className="surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Saldo do mês
            </p>

            <p className="mt-2 text-4xl font-semibold tracking-tight">
              {isLoading ? "—" : formatCurrency(balance)}
            </p>
          </div>

          <MonthSelect
            value={month}
            onChange={setMonth}
            options={monthOpts}
            className="h-8 w-auto shrink-0 gap-1.5 rounded-full border border-border bg-background px-3 text-xs capitalize text-foreground"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5">
          <div>
            <p className="text-xs text-muted-foreground">
              Recebido
            </p>

            <p className="mt-1 text-lg font-semibold text-income">
              {formatCurrency(income)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Gastos
            </p>

            <p className="mt-1 text-lg font-semibold text-expense">
              {formatCurrency(expense)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to="/movimentacoes"
          className="surface p-4 transition-colors hover:border-income/30"
        >
          <div className="flex items-center gap-2 text-income">
            <ArrowDownLeft
              className="size-4"
              strokeWidth={1.8}
            />

            <span className="text-xs font-medium">
              A receber
            </span>
          </div>

          <p className="mt-3 text-xl font-semibold tracking-tight">
            {formatCurrency(pendingIncome)}
          </p>

          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            Ver movimentações
            <ChevronRight className="size-3" />
          </div>
        </Link>

        <Link
          to="/movimentacoes"
          className="surface p-4 transition-colors hover:border-expense/30"
        >
          <div className="flex items-center gap-2 text-expense">
            <ArrowUpRight
              className="size-4"
              strokeWidth={1.8}
            />

            <span className="text-xs font-medium">
              Em aberto
            </span>
          </div>

          <p className="mt-3 text-xl font-semibold tracking-tight">
            {formatCurrency(pendingExpenses)}
          </p>

          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            Ver contas
            <ChevronRight className="size-3" />
          </div>
        </Link>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Próximos lançamentos
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Organizados por vencimento
            </p>
          </div>

          <Link
            to="/movimentacoes"
            className="flex items-center gap-1 text-xs text-slateblue"
          >
            Ver tudo
            <ChevronRight className="size-3" />
          </Link>
        </div>

        {openTransactions.length === 0 ? (
          <EmptyState text="Nenhum lançamento em aberto neste mês." />
        ) : (
          <ul className="space-y-2">
            {openTransactions.slice(0, 5).map((transaction) => (
              <li
                key={transaction.id}
                className="surface flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {transaction.description}
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(transaction.due_date)}
                    </span>

                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
                      Em aberto
                    </span>
                  </div>
                </div>

                <span
                  className={
                    transaction.kind === "entrada"
                      ? "shrink-0 text-sm font-semibold text-income"
                      : "shrink-0 text-sm font-semibold text-expense"
                  }
                >
                  {transaction.kind === "entrada" ? "+" : "-"}
                  {formatCurrency(Number(transaction.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <Link
          to="/movimentacoes"
          className="surface flex items-center justify-between px-4 py-4"
        >
          <div>
            <p className="text-sm font-medium">
              Movimentações
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Entradas, gastos e pagamentos
            </p>
          </div>

          <ChevronRight className="size-4 text-slateblue" />
        </Link>
      </section>

      <section className="mt-3">
        <Link
          to="/metas"
          className="surface flex items-center justify-between px-4 py-4"
        >
          <div>
            <p className="text-sm font-medium">
              Metas financeiras
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Acompanhe seus objetivos
            </p>
          </div>

          <ChevronRight className="size-4 text-slateblue" />
        </Link>
      </section>

      {household ? null : null}
    </AppShell>
  );
}
