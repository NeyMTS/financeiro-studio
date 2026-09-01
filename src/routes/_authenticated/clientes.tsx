import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

const clients = [
  {
    id: 1,
    name: "Ana Souza",
    phone: "(41) 99999-0000",
    lastService: "Maquiagem",
  },
  {
    id: 2,
    name: "Juliana Alves",
    phone: "(41) 98888-0000",
    lastService: "Cílios",
  },
  {
    id: 3,
    name: "Mariana Costa",
    phone: "(41) 97777-0000",
    lastService: "Evento",
  },
];

function ClientesPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/inicio"
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft
                className="size-4"
                strokeWidth={1.7}
              />
            </Link>

            <div>
              <h1 className="text-balance-tight text-2xl font-semibold">
                Clientes
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Seus clientes e atendimentos
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Nova cliente"
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus
              className="size-4.5"
              strokeWidth={2}
            />
          </button>
        </header>

        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.7}
          />

          <input
            type="search"
            placeholder="Buscar cliente..."
            className="h-11 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-income/40 focus:ring-2 focus:ring-income/10"
          />
        </div>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Meus clientes
            </h2>

            <span className="text-xs text-muted-foreground">
              {clients.length} cadastradas
            </span>
          </div>

          <div className="space-y-2">
            {clients.map((client) => (
              <button
                key={client.id}
                type="button"
                className="surface flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:border-income/30"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-income-soft text-income">
                  <UserRound
                    className="size-5"
                    strokeWidth={1.5}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {client.name}
                  </p>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {client.phone}
                  </p>

                  <p className="mt-1 text-[11px] text-slateblue">
                    Último: {client.lastService}
                  </p>
                </div>

                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.6}
                />
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="surface p-5">
            <p className="text-sm font-semibold">
              Atendimento organizado
            </p>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Cada cliente poderá ter seus serviços, valores,
              sinais, pagamentos e histórico reunidos em um só
              lugar.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
