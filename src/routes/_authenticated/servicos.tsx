import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  Heart,
  Hand,
  Plus,
  Scissors,
  Sparkles,
  Star,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";

export const Route = createFileRoute("/_authenticated/servicos")({
  component: ServicosPage,
});

const icons = {
  sparkles: Sparkles,
  olhos: Eye,
  cabelo: Scissors,
  unhas: Hand,
  beleza: Heart,
  especial: Star,
  outros: MoreHorizontal,
};

function ServicosPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("sparkles");
  const [saving, setSaving] = useState(false);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["studio-services", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_services")
        .select("id, name, default_price, icon, active")
        .eq("household_id", household!.id)
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      return data ?? [];
    },
  });

  async function createService() {
    if (!household?.id || !name.trim()) return;

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado.");

      const value = Number(
        price.replace(/\./g, "").replace(",", ".")
      );

      const { error } = await supabase
        .from("studio_services")
        .insert({
          household_id: household.id,
          created_by: user.id,
          name: name.trim(),
          default_price: Number.isFinite(value) ? value : 0,
          icon,
        });

      if (error) throw error;

      setName("");
      setPrice("");
      setIcon("sparkles");
      setShowForm(false);

      await queryClient.invalidateQueries({
        queryKey: ["studio-services", household.id],
      });
    } catch (error) {
      console.error(error);
      alert("Não foi possível cadastrar o serviço.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/inicio"
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground"
            >
              <ArrowLeft className="size-4" strokeWidth={1.7} />
            </Link>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Serviços
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Procedimentos e valores
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="size-4.5" strokeWidth={2} />
          </button>
        </header>

        {showForm && (
          <section className="surface mb-6 p-5">
            <h2 className="text-sm font-semibold">
              Novo serviço
            </h2>

            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome do serviço"
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-income/40"
              />

              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Valor padrão"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-income/40"
              />

              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Ícone
                </p>

                <div className="grid grid-cols-7 gap-2">
                  {Object.entries(icons).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIcon(key)}
                      className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${
                        icon === key
                          ? "border-income bg-income-soft text-income"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <Icon
                        className="size-4"
                        strokeWidth={1.6}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={createService}
                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Cadastrar serviço"}
              </button>
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Meus serviços
            </h2>

            <span className="text-xs text-muted-foreground">
              {services.length} cadastrados
            </span>
          </div>

          {isLoading ? (
            <div className="surface px-4 py-6 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : services.length === 0 ? (
            <div className="surface px-5 py-8 text-center">
              <Sparkles className="mx-auto size-6 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">
                Nenhum serviço cadastrado
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre seus primeiros procedimentos.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service) => {
                const Icon =
                  icons[service.icon as keyof typeof icons] ??
                  Sparkles;

                return (
                  <div
                    key={service.id}
                    className="surface flex items-center gap-4 px-4 py-4"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
                      <Icon
                        className="size-5"
                        strokeWidth={1.6}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {service.name}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Valor padrão
                      </p>
                    </div>

                    <p className="text-sm font-semibold">
                      R${" "}
                      {Number(service.default_price).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
