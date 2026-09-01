import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Eye,
  Scissors,
  Hand,
  Heart,
  Star,
  MoreHorizontal,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/servicos")({
  component: ServicosPage,
});

const iconOptions = [
  { name: "sparkles", icon: Sparkles },
  { name: "olhos", icon: Eye },
  { name: "cabelo", icon: Scissors },
  { name: "unhas", icon: Hand },
  { name: "beleza", icon: Heart },
  { name: "especial", icon: Star },
  { name: "outros", icon: MoreHorizontal },
];

const services = [
  {
    name: "Maquiagem",
    price: 180,
    icon: Sparkles,
  },
  {
    name: "Cílios",
    price: 150,
    icon: Eye,
  },
  {
    name: "Design de sobrancelhas",
    price: 70,
    icon: Heart,
  },
];

function ServicosPage() {
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
              Serviços
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Seus procedimentos e valores
            </p>
          </div>
        </header>

        <button
          type="button"
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" strokeWidth={2} />
          Novo serviço
        </button>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Meus serviços
            </h2>

            <span className="text-xs text-muted-foreground">
              {services.length} cadastrados
            </span>
          </div>

          <div className="space-y-2">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <div
                  key={service.name}
                  className="surface flex items-center gap-4 px-4 py-4"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
                    <Icon className="size-5" strokeWidth={1.6} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {service.name}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Valor padrão
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      R${" "}
                      {service.price.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>

                    <button
                      type="button"
                      className="mt-1 text-[11px] font-medium text-slateblue"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="surface p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-income">
                <Sparkles className="size-5" strokeWidth={1.6} />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Ícones dos serviços
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Escolha um ícone para identificar cada procedimento.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {iconOptions.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`Ícone ${name}`}
                  className="flex aspect-square items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-income/40 hover:bg-income-soft hover:text-income"
                >
                  <Icon className="size-4" strokeWidth={1.6} />
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
