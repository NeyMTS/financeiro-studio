import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";

export const Route = createFileRoute("/_authenticated/a-receber")({
  component: AReceberPage,
});

type Receivable = {
  id: string;
  source: "transaction" | "appointment";
  client: string;
  service: string;
  amount: number;
  date: string;
};

function formatShortDate(iso: string) {
  const parsed = new Date(`${iso}T12:00:00`);

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function AReceberPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const { data: receivables = [], isLoading } = useQuery({
    queryKey: ["studio-receivables", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async (): Promise<Receivable[]> => {
      const [pendingResult, appointmentsResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, description, amount, date, category")
          .eq("household_id", household!.id)
          .eq("type", "income")
          .eq("status", "pending")
          .order("date", { ascending: true }),
        supabase
          .from("studio_appointments")
          .select(
            "id, service_name, total_amount, received_amount, scheduled_date, status, studio_clients(name)"
          )
          .eq("household_id", household!.id)
          .neq("status", "cancelado")
          .order("scheduled_date", { ascending: true }),
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      const fromTransactions: Receivable[] = (pendingResult.data ?? []).map(
        (item) => ({
          id: item.id,
          source: "transaction",
          client: item.description,
          service: item.category ?? "Lançamento pendente",
          amount: Number(item.amount),
          date: item.date ? formatShortDate(item.date) : "",
        })
      );

      const fromAppointments: Receivable[] = (appointmentsResult.data ?? [])
        .map((item) => {
          const relation = item.studio_clients as
            | { name: string }
            | { name: string }[]
            | null;

          const client = Array.isArray(relation) ? relation[0] : relation;

          return {
            id: item.id,
            source: "appointment" as const,
            client: client?.name ?? "Cliente",
            service: item.service_name,
            amount:
              Number(item.total_amount) - Number(item.received_amount),
            date: formatShortDate(item.scheduled_date),
          };
        })
        .filter((item) => item.amount > 0.009);

      return [...fromAppointments, ...fromTransactions];
    },
  });

  const total = receivables.reduce((sum, item) => sum + item.amount, 0);

  async function markReceived(item: Receivable) {
    if (!household?.id) return;

    try {
      if (item.source === "transaction") {
        const { error } = await supabase
          .from("transactions")
          .update({ status: "paid" })
          .eq("id", item.id)
          .eq("household_id", household.id);

        if (error) throw error;
      } else {
        const { data, error: fetchError } = await supabase
          .from("studio_appointments")
          .select("total_amount")
          .eq("id", item.id)
          .single();

        if (fetchError) throw fetchError;

        const { error } = await supabase
          .from("studio_appointments")
          .update({
            received_amount: Number(data.total_amount),
            status: "concluido",
          })
          .eq("id", item.id)
          .eq("household_id", household.id);

        if (error) throw error;
      }

      await queryClient.invalidateQueries();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível atualizar o recebimento.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-8 flex items-center gap-3">
          <Link
            to="/inicio"
            className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={1.7} />
          </Link>

          <div>
            <h1 className="text-balance-tight text-2xl font-semibold">
              A receber
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Valores que ainda não entraram
            </p>
          </div>
        </header>

        <section className="surface overflow-hidden">
          <div className="p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Total a receber
            </p>

            <p className="mt-2 text-4xl font-semibold tracking-tight">
              R${" "}
              {total.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>

            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" strokeWidth={1.7} />
              {receivables.length} valores pendentes
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">
              Pendências
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Organizadas por data de recebimento
            </p>
          </div>

          {isLoading ? (
            <div className="surface p-6 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : receivables.length === 0 ? (
            <div className="surface p-6 text-center text-sm text-muted-foreground">
              Nenhum valor pendente.
            </div>
          ) : (
            <div className="space-y-2">
              {receivables.map((item) => (
                <div
                  key={`${item.source}-${item.id}`}
                  className="surface p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-income-soft text-income">
                      <UserRound
                        className="size-4.5"
                        strokeWidth={1.6}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {item.client}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.service}
                      </p>
                    </div>

                    <p className="text-sm font-semibold">
                      R${" "}
                      {item.amount.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays
                        className="size-3.5"
                        strokeWidth={1.6}
                      />
                      {item.date}
                    </div>

                    <button
                      type="button"
                      onClick={() => markReceived(item)}
                      className="flex items-center gap-1.5 rounded-full bg-income-soft px-3 py-1.5 text-xs font-medium text-income transition-colors hover:bg-income/15"
                    >
                      <Check
                        className="size-3.5"
                        strokeWidth={2}
                      />
                      Recebido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 rounded-2xl border border-dashed border-border px-5 py-4 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Quando um pagamento for recebido, marque como
            <span className="font-medium text-foreground">
              {" "}
              recebido
            </span>
            . Ele passará a fazer parte automaticamente do
            financeiro do mês.
          </p>
        </div>
      </main>
    </div>
  );
}
