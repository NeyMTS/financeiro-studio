import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { AppShell, EmptyState } from "@/components/AppShell";

export const Route = createFileRoute(
  "/_authenticated/movimentacoes"
)({
  component: MovimentacoesPage,
});

type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  status: string | null;
  category: string | null;
};

function MovimentacoesPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [filter, setFilter] = useState<
    "all" | "income" | "expense"
  >("all");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(
    null
  );

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">(
    "income"
  );
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState("paid");
  const [saving, setSaving] = useState(false);

  const monthStart = `${selectedMonth.getFullYear()}-${String(
    selectedMonth.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const monthEndDate = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0
  );

  const monthEnd = `${monthEndDate.getFullYear()}-${String(
    monthEndDate.getMonth() + 1
  ).padStart(2, "0")}-${String(
    monthEndDate.getDate()
  ).padStart(2, "0")}`;

  const monthLabel = selectedMonth.toLocaleDateString(
    "pt-BR",
    {
      month: "long",
      year: "numeric",
    }
  );

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: [
      "studio-transactions",
      household?.id,
      monthStart,
      monthEnd,
    ],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, description, amount, type, date, status, category"
        )
        .eq("household_id", household!.id)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Transaction[];
    },
  });

  const visibleTransactions = useMemo(() => {
    if (filter === "all") return transactions;

    return transactions.filter(
      (transaction) => transaction.type === filter
    );
  }, [transactions, filter]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === "income")
      .filter((item) => item.status !== "pending")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const expense = transactions
      .filter((item) => item.type === "expense")
      .filter((item) => item.status !== "pending")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const pending = transactions
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      income,
      expense,
      balance: income - expense,
      pending,
    };
  }, [transactions]);

  function formatMoney(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    });
  }

  function parseMoney(value: string) {
    return (
      Number(value.replace(/\./g, "").replace(",", ".")) || 0
    );
  }

  function previousMonth() {
    setSelectedMonth(
      new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() - 1,
        1
      )
    );
  }

  function nextMonth() {
    setSelectedMonth(
      new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        1
      )
    );
  }

  function openNew() {
    setEditing(null);
    setDescription("");
    setAmount("");
    setType("income");
    setDate(new Date().toISOString().slice(0, 10));
    setStatus("paid");
    setShowForm(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setDescription(transaction.description);
    setAmount(formatMoney(Number(transaction.amount)));
    setType(transaction.type);
    setDate(transaction.date);
    setStatus(transaction.status || "paid");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditing(null);
  }

  async function saveTransaction() {
    if (
      !household?.id ||
      !description.trim() ||
      !amount ||
      !date
    ) {
      alert("Preencha descrição, valor e data da movimentação.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado.");

      const payload = {
        description: description.trim(),
        amount: parseMoney(amount),
        type,
        date,
        status,
      };

      if (editing) {
        const { error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", editing.id)
          .eq("household_id", household.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transactions")
          .insert({
            household_id: household.id,
            user_id: user.id,
            ...payload,
          });

        if (error) throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ["studio-transactions"],
      });

      closeForm();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível salvar a movimentação.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(transaction: Transaction) {
    if (
      !window.confirm(
        `Excluir "${transaction.description}"?`
      ) ||
      !household?.id
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.id)
        .eq("household_id", household.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["studio-transactions"],
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível excluir a movimentação.");
    }
  }

  async function markAsPaid(transaction: Transaction) {
    if (!household?.id) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("id", transaction.id)
        .eq("household_id", household.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["studio-transactions"],
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível atualizar o pagamento.");
    }
  }

  return (
    <AppShell
      title="Financeiro"
      subtitle="Entradas, gastos e recebimentos"
      action={
        <button
          type="button"
          onClick={openNew}
          className="flex size-10 items-center justify-center rounded-full bg-[#b7838e] text-white shadow-sm active:scale-95"
        >
          <Plus className="size-4.5" strokeWidth={1.9} />
        </button>
      }
    >
      <div className="flex items-center justify-between rounded-2xl border border-black/[0.05] bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={previousMonth}
          className="flex size-9 items-center justify-center rounded-full text-[#817b7d]"
        >
          ‹
        </button>

        <p className="text-sm font-semibold capitalize text-[#211f20]">
          {monthLabel}
        </p>

        <button
          type="button"
          onClick={nextMonth}
          className="flex size-9 items-center justify-center rounded-full text-[#817b7d]"
        >
          ›
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#f3e5e8] p-4">
          <p className="text-xs text-[#8d6871]">Recebido</p>
          <p className="mt-1 text-lg font-semibold text-[#211f20]">
            R$ {formatMoney(totals.income)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
          <p className="text-xs text-[#817b7d]">Gastos</p>
          <p className="mt-1 text-lg font-semibold text-[#211f20]">
            R$ {formatMoney(totals.expense)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
          <p className="text-xs text-[#817b7d]">Saldo</p>
          <p className="mt-1 text-lg font-semibold text-[#211f20]">
            R$ {formatMoney(totals.balance)}
          </p>
        </div>

        <div className="rounded-2xl bg-[#f8eef0] p-4">
          <p className="text-xs text-[#8d6871]">
            A receber / pendente
          </p>
          <p className="mt-1 text-lg font-semibold text-[#211f20]">
            R$ {formatMoney(totals.pending)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto">
        {[
          ["all", "Todos"],
          ["income", "Entradas"],
          ["expense", "Gastos"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              setFilter(value as "all" | "income" | "expense")
            }
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium ${
              filter === value
                ? "bg-[#b7838e] text-white"
                : "bg-white text-[#817b7d] ring-1 ring-black/[0.05]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="mt-6">
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[#817b7d]">
            Carregando...
          </div>
        ) : visibleTransactions.length === 0 ? (
          <EmptyState text="Nenhuma movimentação neste mês." />
        ) : (
          <div className="space-y-2">
            {visibleTransactions.map((transaction) => {
              const isIncome = transaction.type === "income";
              const isPending =
                transaction.status === "pending";

              return (
                <div
                  key={transaction.id}
                  className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        isIncome
                          ? "bg-[#f3e5e8] text-[#9d6875]"
                          : "bg-[#f5f3f2] text-[#625d5f]"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpCircle
                          className="size-5"
                          strokeWidth={1.6}
                        />
                      ) : (
                        <ArrowDownCircle
                          className="size-5"
                          strokeWidth={1.6}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#211f20]">
                        {transaction.description}
                      </p>

                      <p className="mt-1 text-xs text-[#817b7d]">
                        {new Date(
                          `${transaction.date}T12:00:00`
                        ).toLocaleDateString("pt-BR")}
                        {transaction.category
                          ? ` · ${transaction.category}`
                          : ""}
                      </p>
                    </div>

                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        isIncome
                          ? "text-[#9d6875]"
                          : "text-[#211f20]"
                      }`}
                    >
                      {isIncome ? "+" : "-"} R${" "}
                      {formatMoney(Number(transaction.amount))}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                        isPending
                          ? "bg-[#f8eee0] text-[#9a7654]"
                          : "bg-[#edf5ef] text-[#64816b]"
                      }`}
                    >
                      {isPending ? "A receber" : "Pago"}
                    </span>

                    <div className="flex gap-2">
                      {isPending && (
                        <button
                          type="button"
                          onClick={() =>
                            markAsPaid(transaction)
                          }
                          className="flex size-8 items-center justify-center rounded-lg bg-[#edf5ef] text-[#64816b]"
                          aria-label="Marcar como pago"
                        >
                          <Check
                            className="size-4"
                            strokeWidth={1.8}
                          />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openEdit(transaction)
                        }
                        className="flex size-8 items-center justify-center rounded-lg bg-[#f6f3f3] text-[#625d5f]"
                        aria-label="Editar"
                      >
                        <Pencil
                          className="size-3.5"
                          strokeWidth={1.7}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteTransaction(transaction)
                        }
                        className="flex size-8 items-center justify-center rounded-lg bg-[#f6f3f3] text-[#8d696f]"
                        aria-label="Excluir"
                      >
                        <Trash2
                          className="size-3.5"
                          strokeWidth={1.7}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-4 pb-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#211f20]">
                  {editing
                    ? "Editar movimentação"
                    : "Nova movimentação"}
                </h2>

                <p className="mt-1 text-xs text-[#817b7d]">
                  Registre uma entrada ou um gasto.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="flex size-9 items-center justify-center rounded-full bg-[#f6f3f3] text-[#817b7d]"
              >
                <X className="size-4" strokeWidth={1.7} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`h-10 rounded-xl text-sm font-medium ${
                    type === "income"
                      ? "bg-[#f3e5e8] text-[#9d6875]"
                      : "bg-[#faf9f8] text-[#817b7d]"
                  }`}
                >
                  Entrada
                </button>

                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`h-10 rounded-xl text-sm font-medium ${
                    type === "expense"
                      ? "bg-[#ece9e7] text-[#625d5f]"
                      : "bg-[#faf9f8] text-[#817b7d]"
                  }`}
                >
                  Gasto
                </button>
              </div>

              <input
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Descrição"
                autoFocus
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              />

              <input
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="Valor"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              />

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              />

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              >
                <option value="paid">Pago / Recebido</option>
                <option value="pending">A receber / Pendente</option>
              </select>

              <button
                type="button"
                disabled={
                  saving ||
                  !description.trim() ||
                  !amount ||
                  !date
                }
                onClick={saveTransaction}
                className="h-11 w-full rounded-xl bg-[#b7838e] text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : editing
                    ? "Salvar alterações"
                    : "Adicionar movimentação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
