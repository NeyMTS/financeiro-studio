import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["studio-clients", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_clients")
        .select("id, name, phone, created_at")
        .eq("household_id", household!.id)
        .order("name", { ascending: true });

      if (error) throw error;

      return data ?? [];
    },
  });

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase())
  );

  async function createClient() {
    if (!household?.id || !name.trim()) return;

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado.");

      const { error } = await supabase
        .from("studio_clients")
        .insert({
          household_id: household.id,
          created_by: user.id,
          name: name.trim(),
          phone: phone.trim() || null,
        });

      if (error) throw error;

      setName("");
      setPhone("");
      setShowForm(false);

      await queryClient.invalidateQueries({
        queryKey: ["studio-clients", household.id],
      });
    } catch (error) {
      console.error(error);
      alert("Não foi possível cadastrar a cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/inicio"
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground"
            >
              <ArrowLeft className="size-4" strokeWidth={1.7} />
            </Link>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Clientes
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Seus clientes e atendimentos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            aria-label="Nova cliente"
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="size-4.5" strokeWidth={2} />
          </button>
        </header>

        {showForm && (
          <section className="surface mb-5 p-5">
            <h2 className="text-sm font-semibold">
              Nova cliente
            </h2>

            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome da cliente"
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-income/40"
              />

              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Telefone (opcional)"
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-income/40"
              />

              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={createClient}
                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Cadastrar cliente"}
              </button>
            </div>
          </section>
        )}

        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.7}
          />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente..."
            className="h-11 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm outline-none focus:border-income/40"
          />
        </div>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Minhas clientes
            </h2>

            <span className="text-xs text-muted-foreground">
              {clients.length} cadastradas
            </span>
          </div>

          {isLoading ? (
            <div className="surface px-4 py-6 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="surface px-5 py-8 text-center">
              <UserRound className="mx-auto size-6 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">
                Nenhuma cliente encontrada
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre sua primeira cliente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="surface flex items-center gap-3 px-4 py-4"
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
                      {client.phone || "Telefone não informado"}
                    </p>
                  </div>

                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.6}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
