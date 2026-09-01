import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Hand,
  Heart,
  MoreHorizontal,
  Pencil,
  Plus,
  Scissors,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { AppShell, EmptyState } from "@/components/AppShell";

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

type Service = {
  id: string;
  name: string;
  default_price: number;
  icon: string | null;
  active: boolean;
};

function ServicosPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] =
    useState<Service | null>(null);

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

      return (data ?? []) as Service[];
    },
  });

  function parseMoney(value: string) {
    return (
      Number(value.replace(/\./g, "").replace(",", ".")) || 0
    );
  }

  function formatMoney(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    });
  }

  function openNew() {
    setEditingService(null);
    setName("");
    setPrice("");
    setIcon("sparkles");
    setShowForm(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setName(service.name);
    setPrice(formatMoney(Number(service.default_price)));
    setIcon(service.icon || "sparkles");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingService(null);
    setName("");
    setPrice("");
    setIcon("sparkles");
  }

  async function saveService() {
    if (!household?.id || !name.trim()) return;

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      const value = parseMoney(price);

      if (editingService) {
        const { error } = await supabase
          .from("studio_services")
          .update({
            name: name.trim(),
            default_price: value,
            icon,
          })
          .eq("id", editingService.id)
          .eq("household_id", household.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("studio_services")
          .insert({
            household_id: household.id,
            created_by: user.id,
            name: name.trim(),
            default_price: value,
            icon,
            active: true,
          });

        if (error) throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ["studio-services", household.id],
      });

      closeForm();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível salvar o serviço.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(service: Service) {
    const confirmed = window.confirm(
      `Excluir o serviço "${service.name}"?`
    );

    if (!confirmed || !household?.id) return;

    try {
      const { error } = await supabase
        .from("studio_services")
        .update({ active: false })
        .eq("id", service.id)
        .eq("household_id", household.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["studio-services", household.id],
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível excluir o serviço.");
    }
  }

  return (
    <AppShell
      title="Serviços"
      subtitle="Procedimentos e valores"
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
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#211f20]">
            Meus serviços
          </h2>

          <span className="text-xs text-[#817b7d]">
            {services.length} cadastrados
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-black/[0.05] bg-white px-4 py-7 text-center text-sm text-[#817b7d]">
            Carregando...
          </div>
        ) : services.length === 0 ? (
          <EmptyState text="Nenhum serviço cadastrado." />
        ) : (
          <div className="space-y-2">
            {services.map((service) => {
              const Icon =
                icons[service.icon as keyof typeof icons] ??
                Sparkles;

              return (
                <div
                  key={service.id}
                  className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#f3e5e8] text-[#9d6875]">
                      <Icon
                        className="size-5"
                        strokeWidth={1.6}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#211f20]">
                        {service.name}
                      </p>

                      <p className="mt-1 text-xs text-[#817b7d]">
                        Valor padrão
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-semibold text-[#211f20]">
                      R$ {formatMoney(Number(service.default_price))}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/[0.05] pt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
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
                      onClick={() => deleteService(service)}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] text-xs font-medium text-[#8d696f]"
                    >
                      <Trash2
                        className="size-3.5"
                        strokeWidth={1.7}
                      />
                      Excluir
                    </button>
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
                  {editingService
                    ? "Editar serviço"
                    : "Novo serviço"}
                </h2>

                <p className="mt-1 text-xs text-[#817b7d]">
                  Nome, valor e ícone do procedimento.
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
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Nome do serviço"
                autoFocus
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              />

              <input
                value={price}
                onChange={(event) =>
                  setPrice(event.target.value)
                }
                placeholder="Valor padrão"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
              />

              <div>
                <p className="mb-2 text-xs text-[#817b7d]">
                  Ícone
                </p>

                <div className="grid grid-cols-7 gap-2">
                  {Object.entries(icons).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIcon(key)}
                      aria-label={`Ícone ${key}`}
                      className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${
                        icon === key
                          ? "border-[#b7838e] bg-[#f3e5e8] text-[#9d6875]"
                          : "border-black/[0.06] bg-[#faf9f8] text-[#817b7d]"
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
                onClick={saveService}
                className="h-11 w-full rounded-xl bg-[#b7838e] text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : editingService
                    ? "Salvar alterações"
                    : "Cadastrar serviço"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
