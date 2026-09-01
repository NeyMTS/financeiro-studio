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
import { useEffect, useMemo, useState } from "react";
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

const categories = [
  "Cílios",
  "Maquiagem",
  "Sobrancelhas",
  "Unhas",
  "Cabelo",
  "Outros",
];

type Service = {
  id: string;
  name: string;
  default_price: number;
  icon: string | null;
  active: boolean;
};

type ServiceExtra = {
  category: string;
  duration_minutes: number;
};

type ServiceMetadata = Record<string, ServiceExtra>;

function getMetadataKey(householdId: string) {
  return `studio-services-metadata-${householdId}`;
}

function loadMetadata(householdId?: string): ServiceMetadata {
  if (!householdId || typeof window === "undefined") return {};

  try {
    const saved = localStorage.getItem(
      getMetadataKey(householdId)
    );

    if (!saved) return {};

    return JSON.parse(saved) as ServiceMetadata;
  } catch {
    return {};
  }
}

function saveMetadata(
  householdId: string,
  metadata: ServiceMetadata
) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    getMetadataKey(householdId),
    JSON.stringify(metadata)
  );
}

function formatDuration(minutes: number) {
  if (!minutes) return "Duração não definida";

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (!remaining) {
    return hours === 1
      ? "1 hora"
      : `${hours} horas`;
  }

  return `${hours}h ${remaining}min`;
}

function ServicosPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] =
    useState<Service | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("sparkles");

  const [category, setCategory] = useState("Cílios");
  const [duration, setDuration] = useState("60");

  const [metadata, setMetadata] =
    useState<ServiceMetadata>({});

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!household?.id) return;

    setMetadata(loadMetadata(household.id));
  }, [household?.id]);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["studio-services", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_services")
        .select(
          "id, name, default_price, icon, active"
        )
        .eq("household_id", household!.id)
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data ?? []) as Service[];
    },
  });

  function parseMoney(value: string) {
    return (
      Number(
        value.replace(/\./g, "").replace(",", ".")
      ) || 0
    );
  }

  function formatMoney(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getServiceMetadata(service: Service) {
    return (
      metadata[service.id] ?? {
        category: "Outros",
        duration_minutes: 60,
      }
    );
  }

  function openNew() {
    setEditingService(null);
    setName("");
    setPrice("");
    setIcon("sparkles");
    setCategory("Cílios");
    setDuration("60");
    setShowForm(true);
  }

  function openEdit(service: Service) {
    const extra = getServiceMetadata(service);

    setEditingService(service);
    setName(service.name);
    setPrice(
      formatMoney(Number(service.default_price))
    );
    setIcon(service.icon || "sparkles");
    setCategory(extra.category);
    setDuration(
      String(extra.duration_minutes || 60)
    );
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingService(null);
    setName("");
    setPrice("");
    setIcon("sparkles");
    setCategory("Cílios");
    setDuration("60");
  }

  async function saveService() {
    if (!household?.id || !name.trim()) {
      alert("Informe o nome do serviço.");
      return;
    }

    const durationMinutes = Number(duration);

    if (
      !durationMinutes ||
      durationMinutes < 15
    ) {
      alert(
        "Informe uma duração válida de pelo menos 15 minutos."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Usuário não autenticado."
        );
      }

      const value = parseMoney(price);

      let serviceId = editingService?.id;

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
        const { data, error } = await supabase
          .from("studio_services")
          .insert({
            household_id: household.id,
            created_by: user.id,
            name: name.trim(),
            default_price: value,
            icon,
            active: true,
          })
          .select(
            "id, name, default_price, icon, active"
          )
          .single();

        if (error) throw error;

        serviceId = data.id;
      }

      if (serviceId) {
        const nextMetadata = {
          ...metadata,
          [serviceId]: {
            category,
            duration_minutes: durationMinutes,
          },
        };

        setMetadata(nextMetadata);
        saveMetadata(
          household.id,
          nextMetadata
        );
      }

      await queryClient.invalidateQueries({
        queryKey: [
          "studio-services",
          household.id,
        ],
      });

      closeForm();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o serviço."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(service: Service) {
    const confirmed = window.confirm(
      `Excluir o serviço "${service.name}"?`
    );

    if (
      !confirmed ||
      !household?.id
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("studio_services")
        .update({ active: false })
        .eq("id", service.id)
        .eq("household_id", household.id);

      if (error) throw error;

      const nextMetadata = {
        ...metadata,
      };

      delete nextMetadata[service.id];

      setMetadata(nextMetadata);

      saveMetadata(
        household.id,
        nextMetadata
      );

      await queryClient.invalidateQueries({
        queryKey: [
          "studio-services",
          household.id,
        ],
      });
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o serviço."
      );
    }
  }

  const groupedServices = useMemo(() => {
    const groups: Record<
      string,
      Service[]
    > = {};

    categories.forEach((item) => {
      groups[item] = [];
    });

    services.forEach((service) => {
      const serviceCategory =
        getServiceMetadata(service).category;

      if (!groups[serviceCategory]) {
        groups[serviceCategory] = [];
      }

      groups[serviceCategory].push(service);
    });

    return groups;
  }, [services, metadata]);

  return (
    <AppShell
      title="Serviços"
      subtitle="Procedimentos, valores e duração"
      action={
        <button
          type="button"
          onClick={openNew}
          className="flex size-10 items-center justify-center rounded-full bg-[#b7838e] text-white shadow-sm active:scale-95"
          aria-label="Novo serviço"
        >
          <Plus
            className="size-4.5"
            strokeWidth={1.9}
          />
        </button>
      }
    >
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#211f20]">
              Meus serviços
            </h2>

            <p className="mt-1 text-xs text-[#817b7d]">
              Organize por categoria e duração.
            </p>
          </div>

          <span className="text-xs text-[#817b7d]">
            {services.length} cadastrados
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-black/[0.05] bg-white px-4 py-7 text-center text-sm text-[#817b7d]">
            Carregando...
          </div>
        ) : services.length === 0 ? (
          <div>
            <EmptyState text="Nenhum serviço cadastrado." />

            <button
              type="button"
              onClick={openNew}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b7838e] py-3 text-sm font-semibold text-white"
            >
              <Plus
                className="size-4"
                strokeWidth={1.8}
              />
              Cadastrar primeiro serviço
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(
              (categoryName) => {
                const categoryServices =
                  groupedServices[
                    categoryName
                  ] ?? [];

                if (
                  categoryServices.length === 0
                ) {
                  return null;
                }

                return (
                  <div
                    key={categoryName}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-px flex-1 bg-black/[0.06]" />

                      <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d6875]">
                        {categoryName}
                      </h3>

                      <div className="h-px flex-1 bg-black/[0.06]" />
                    </div>

                    <div className="space-y-2">
                      {categoryServices.map(
                        (service) => {
                          const Icon =
                            icons[
                              service.icon as keyof typeof icons
                            ] ?? Sparkles;

                          const extra =
                            getServiceMetadata(
                              service
                            );

                          return (
                            <div
                              key={
                                service.id
                              }
                              className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#f3e5e8] text-[#9d6875]">
                                  <Icon
                                    className="size-5"
                                    strokeWidth={
                                      1.6
                                    }
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-[#211f20]">
                                    {
                                      service.name
                                    }
                                  </p>

                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-[#f7f3f4] px-2 py-1 text-[10px] text-[#817b7d]">
                                      ⏱{" "}
                                      {formatDuration(
                                        extra.duration_minutes
                                      )}
                                    </span>

                                    <span className="text-[10px] text-[#aaa5a6]">
                                      {
                                        extra.category
                                      }
                                    </span>
                                  </div>
                                </div>

                                <p className="shrink-0 text-sm font-semibold text-[#211f20]">
                                  R${" "}
                                  {formatMoney(
                                    Number(
                                      service.default_price
                                    )
                                  )}
                                </p>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/[0.05] pt-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEdit(
                                      service
                                    )
                                  }
                                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] text-xs font-medium text-[#625d5f]"
                                >
                                  <Pencil
                                    className="size-3.5"
                                    strokeWidth={
                                      1.7
                                    }
                                  />
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteService(
                                      service
                                    )
                                  }
                                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] text-xs font-medium text-[#8d696f]"
                                >
                                  <Trash2
                                    className="size-3.5"
                                    strokeWidth={
                                      1.7
                                    }
                                  />
                                  Excluir
                                </button>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-4 pb-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#aaa5a6]">
                  Studio Lary Andrade
                </p>

                <h2 className="mt-1 text-base font-semibold text-[#211f20]">
                  {editingService
                    ? "Editar serviço"
                    : "Novo serviço"}
                </h2>

                <p className="mt-1 text-xs text-[#817b7d]">
                  Defina o procedimento,
                  valor, categoria e duração.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="flex size-9 items-center justify-center rounded-full bg-[#f6f3f3] text-[#817b7d]"
                aria-label="Fechar"
              >
                <X
                  className="size-4"
                  strokeWidth={1.7}
                />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* NOME */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Nome do serviço
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Ex.: Alongamento de cílios"
                  autoFocus
                  className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm text-[#211f20] outline-none focus:border-[#b7838e]/50"
                />
              </div>

              {/* CATEGORIA */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Categoria
                </label>

                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm text-[#211f20] outline-none focus:border-[#b7838e]/50"
                >
                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* VALOR */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Valor padrão
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#aaa5a6]">
                    R$
                  </span>

                  <input
                    value={price}
                    onChange={(event) =>
                      setPrice(
                        event.target.value
                      )
                    }
                    placeholder="0,00"
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-black/[0.07] bg-[#faf9f8] pl-9 pr-4 text-sm text-[#211f20] outline-none focus:border-[#b7838e]/50"
                  />
                </div>
              </div>

              {/* DURAÇÃO */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Duração do atendimento
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: "30",
                      label: "30 min",
                    },
                    {
                      value: "45",
                      label: "45 min",
                    },
                    {
                      value: "60",
                      label: "1 hora",
                    },
                    {
                      value: "90",
                      label: "1h 30",
                    },
                    {
                      value: "120",
                      label: "2 horas",
                    },
                    {
                      value: "180",
                      label: "3 horas",
                    },
                  ].map(
                    (item) => (
                      <button
                        key={
                          item.value
                        }
                        type="button"
                        onClick={() =>
                          setDuration(
                            item.value
                          )
                        }
                        className={`h-10 rounded-xl border text-xs font-medium transition-colors ${
                          duration ===
                          item.value
                            ? "border-[#b7838e] bg-[#f3e5e8] text-[#9d6875]"
                            : "border-black/[0.06] bg-[#faf9f8] text-[#817b7d]"
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-[#aaa5a6]">
                    Ou informe outro tempo:
                  </span>

                  <input
                    value={duration}
                    onChange={(event) =>
                      setDuration(
                        event.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    inputMode="numeric"
                    className="h-9 w-20 rounded-lg border border-black/[0.07] bg-[#faf9f8] px-2 text-center text-xs text-[#211f20] outline-none focus:border-[#b7838e]/50"
                  />

                  <span className="text-[10px] text-[#aaa5a6]">
                    minutos
                  </span>
                </div>
              </div>

              {/* ÍCONE */}
              <div>
                <p className="mb-2 text-xs font-medium text-[#625d5f]">
                  Ícone
                </p>

                <div className="grid grid-cols-7 gap-2">
                  {Object.entries(
                    icons
                  ).map(
                    ([key, Icon]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setIcon(key)
                        }
                        aria-label={`Ícone ${key}`}
                        className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${
                          icon === key
                            ? "border-[#b7838e] bg-[#f3e5e8] text-[#9d6875]"
                            : "border-black/[0.06] bg-[#faf9f8] text-[#817b7d]"
                        }`}
                      >
                        <Icon
                          className="size-4"
                          strokeWidth={
                            1.6
                          }
                        />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* RESUMO */}
              <div className="rounded-2xl bg-[#f3e5e8] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#817b7d]">
                    Categoria
                  </span>

                  <strong className="text-xs text-[#9d6875]">
                    {category}
                  </strong>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-[#817b7d]">
                    Duração
                  </span>

                  <strong className="text-xs text-[#9d6875]">
                    {formatDuration(
                      Number(duration)
                    )}
                  </strong>
                </div>

                {price && (
                  <div className="mt-2 flex items-center justify-between border-t border-[#b7838e]/20 pt-2">
                    <span className="text-xs text-[#817b7d]">
                      Valor
                    </span>

                    <strong className="text-sm text-[#211f20]">
                      R${" "}
                      {formatMoney(
                        parseMoney(price)
                      )}
                    </strong>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={
                  saving ||
                  !name.trim() ||
                  !duration
                }
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
