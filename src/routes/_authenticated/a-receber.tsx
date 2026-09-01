import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/a-receber")({
  component: AReceberPage,
});

const receivables = [
  {
    id: 1,
    client: "Ana",
    service: "Maquiagem",
    amount: 200,
    date: "20/09",
  },
  {
    id: 2,
    client: "Juliana",
    service: "Cílios",
    amount: 150,
    date: "22/09",
  },
  {
    id: 3,
    client: "Mariana",
    service: "Evento",
    amount: 350,
    date: "28/09",
  },
];

function AReceberPage() {
  const total = receivables.reduce(
    (sum, item) => sum + item.amount,
    0
  );

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

          <div className="space-y-2">
            {receivables.map((item) => (
              <div
                key={item.id}
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
