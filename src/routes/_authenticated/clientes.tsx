import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cake,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { AppShell, EmptyState } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

type Client = {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
  created_at: string;
};

function ClientesPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["studio-clients", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_clients")
        .select("id, name, phone, birth_date, created_at")
        .eq("household_id", household!.id)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data ?? []) as Client[];
    },
  });

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const selectedClientId = window.location.hash.replace("#cliente-", "");
    if (!selectedClientId || showForm) return;
    const client = clients.find((item) => item.id === selectedClientId);
    if (client) openEditClient(client);
  }, [clients, showForm]);

  function openNewClient() {
    setEditingClient(null);
    setName("");
    setPhone("");
    setBirthDate("");
    setShowForm(true);
  }

  function openEditClient(client: Client) {
    setEditingClient(client);
    setName(client.name);
    setPhone(client.phone ?? "");
    setBirthDate(client.birth_date ?? "");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingClient(null);
    setName("");
    setPhone("");
    setBirthDate("");
  }

  async function saveClient() {
    if (!household?.id || !name.trim()) return;

    setSaving(true);

    try {
      if (editingClient) {
        const { error } = await supabase
          .from("studio_clients")
          .update({
            name: name.trim(),
            phone: phone.trim() || null,
            birth_date: birthDate || null,
          })
          .eq("id", editingClient.id)
          .eq("household_id", household.id);

        if (error) throw error;
      } else {
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
            birth_date: birthDate || null,
          });

        if (error) throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ["studio-clients", household.id],
      });

      closeForm();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível salvar a cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(client: Client) {
    const confirmed = window.confirm(
      `Excluir a cliente "${client.name}"?`
    );

    if (!confirmed || !household?.id) return;

    try {
      const { error } = await supabase
        .from("studio_clients")
        .delete()
        .eq("id", client.id)
        .eq("household_id", household.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["studio-clients", household.id],
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível excluir a cliente.");
    }
  }

  function openWhatsApp(client: Client) {
    if (!client.phone) {
      alert("Cadastre o telefone da cliente primeiro.");
      return;
    }

    const phone = client.phone.replace(/\D/g, "");

    if (!phone) {
      alert("O telefone cadastrado é inválido.");
      return;
    }

    const message = `Olá, ${client.name}! 💕\n\nAqui é o Studio Lary Andrade.\n\nGostaríamos de confirmar seu atendimento.\n\nPedimos, por favor, que chegue 10 minutos antes do horário agendado.\n\nSerá um prazer receber você! 💕\nStudio Lary Andrade`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  }

  function openBirthdayWhatsApp(client: Client) {
    if (!client.phone) {
      alert("Cadastre o telefone da cliente primeiro.");
      return;
    }

    const phone = client.phone.replace(/\D/g, "");
    if (!phone) {
      alert("O telefone cadastrado é inválido.");
      return;
    }

    const message = `Olá, ${client.name}! 💕\n\nAqui é o Studio Lary Andrade.\n\nPassando para desejar um feliz aniversário! 🎂✨\n\nQue seu novo ciclo seja cheio de coisas boas, saúde, felicidade e muitos momentos especiais.\n\nUm beijo,\n\nStudio Lary Andrade 💕`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  function formatBirthday(value: string) {
    return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
    });
  }

  return (
    <AppShell
      title="Clientes"
      subtitle={`${clients.length} ${
        clients.length === 1 ? "cliente" : "clientes"
      } cadastradas`}
      action={
        <button
          type="button"
          onClick={openNewClient}
          aria-label="Nova cliente"
          className="flex size-10 items-center justify-center rounded-full bg-[#b7838e] text-white shadow-sm transition-transform active:scale-95"
        >
          <Plus className="size-4.5" strokeWidth={1.9} />
        </button>
      }
    >
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#9b9597]"
          strokeWidth={1.7}
        />

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente..."
          className="h-11 w-full rounded-2xl border border-black/[0.06] bg-white pl-11 pr-4 text-sm text-[#211f20] outline-none placeholder:text-[#aaa5a6] focus:border-[#b7838e]/50"
        />
      </div>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#211f20]">
            Minhas clientes
          </h2>

          <span className="text-xs text-[#8a8587]">
            {filteredClients.length}
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-black/[0.05] bg-white px-4 py-7 text-center text-sm text-[#817b7d]">
            Carregando...
          </div>
        ) : filteredClients.length === 0 ? (
          <EmptyState text="Nenhuma cliente encontrada." />
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f3e5e8] text-[#a76f7d]">
                    <UserRound
                      className="size-5"
                      strokeWidth={1.5}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#211f20]">
                      {client.name}
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#817b7d]">
                      <Phone
                        className="size-3"
                        strokeWidth={1.6}
                      />
                      {client.phone || "Telefone não informado"}
                    </p>
                    {client.birth_date && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#817b7d]">
                        <Cake className="size-3" strokeWidth={1.6} />
                        {formatBirthday(client.birth_date)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => openWhatsApp(client)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#f3e5e8] text-xs font-medium text-[#9d6875]"
                  >
                    <MessageCircle
                      className="size-3.5"
                      strokeWidth={1.7}
                    />
                    WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditClient(client)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] text-xs font-medium text-[#625d5f]"
                  >
                    <Pencil
                      className="size-3.5"
                      strokeWidth={1.7}
                    />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteClient(client)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] text-xs font-medium text-[#8d696f]"
                  >
                    <Trash2
                      className="size-3.5"
                      strokeWidth={1.7}
                    />
                    Excluir
                  </button>
                </div>
                {client.birth_date && (
                  <button
                    type="button"
                    onClick={() => openBirthdayWhatsApp(client)}
                    className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#f8eef0] text-xs font-medium text-[#9d6875]"
                  >
                    <Cake className="size-3.5" strokeWidth={1.7} />
                    Parabenizar no WhatsApp
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-4 pb-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#211f20]">
                  {editingClient
                    ? "Editar cliente"
                    : "Nova cliente"}
                </h2>

                <p className="mt-1 text-xs text-[#817b7d]">
                  Cadastre os dados básicos.
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
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome da cliente"
                autoFocus
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              />

              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="WhatsApp / telefone"
                inputMode="tel"
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              />

              <label className="block">
                <span className="mb-2 block text-xs text-[#817b7d]">Data de aniversário (opcional)</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
                />
              </label>

              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={saveClient}
                className="h-11 w-full rounded-xl bg-[#b7838e] text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : editingClient
                    ? "Salvar alterações"
                    : "Cadastrar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
