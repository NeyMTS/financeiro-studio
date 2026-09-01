import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { AppShell, EmptyState } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

type Appointment = {
  id: string;
  service_name: string;
  total_amount: number;
  deposit_amount: number;
  received_amount: number;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  studio_clients:
    | { name: string; phone: string | null }
    | { name: string; phone: string | null }[]
    | null;
};

function AgendaPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const monthStart = useMemo(
    () =>
      `${selectedMonth.getFullYear()}-${String(
        selectedMonth.getMonth() + 1
      ).padStart(2, "0")}-01`,
    [selectedMonth]
  );

  const monthEnd = useMemo(() => {
    const end = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      0
    );

    return `${end.getFullYear()}-${String(
      end.getMonth() + 1
    ).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  }, [selectedMonth]);

  const monthLabel = selectedMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["studio-clients", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_clients")
        .select("id, name, phone")
        .eq("household_id", household!.id)
        .order("name");

      if (error) throw error;

      return data ?? [];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["studio-services", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_services")
        .select("id, name, default_price")
        .eq("household_id", household!.id)
        .eq("active", true)
        .order("name");

      if (error) throw error;

      return data ?? [];
    },
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: [
      "studio-appointments",
      household?.id,
      monthStart,
      monthEnd,
    ],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_appointments")
        .select(
          `
          id,
          service_name,
          total_amount,
          deposit_amount,
          received_amount,
          scheduled_date,
          scheduled_time,
          status,
          studio_clients(name, phone)
        `
        )
        .eq("household_id", household!.id)
        .gte("scheduled_date", monthStart)
        .lte("scheduled_date", monthEnd)
        .neq("status", "cancelado")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (error) throw error;

      return (data ?? []) as Appointment[];
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
    setClientId("");
    setServiceId("");
    setServiceName("");
    setTotal("");
    setDeposit("");
    setDate("");
    setTime("");
    setShowForm(true);
  }

  function openEdit(appointment: Appointment) {
    const client = Array.isArray(appointment.studio_clients)
      ? appointment.studio_clients[0]
      : appointment.studio_clients;

    const foundClient = clients.find(
      (item) => item.name === client?.name
    );

    const foundService = services.find(
      (item) => item.name === appointment.service_name
    );

    setEditing(appointment);
    setClientId(foundClient?.id ?? "");
    setServiceId(foundService?.id ?? "");
    setServiceName(appointment.service_name);
    setTotal(formatMoney(Number(appointment.total_amount)));
    setDeposit(formatMoney(Number(appointment.deposit_amount)));
    setDate(appointment.scheduled_date);
    setTime(appointment.scheduled_time?.slice(0, 5) ?? "");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditing(null);
  }

  function handleServiceChange(id: string) {
    setServiceId(id);

    const service = services.find((item) => item.id === id);

    if (service) {
      setServiceName(service.name);
      setTotal(formatMoney(Number(service.default_price)));
    }
  }

  async function saveAppointment() {
    if (
      !household?.id ||
      !clientId ||
      !serviceName ||
      !date ||
      !total
    ) {
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado.");

      const totalAmount = parseMoney(total);
      const depositAmount = Math.min(
        parseMoney(deposit),
        totalAmount
      );

      if (editing) {
        const { error } = await supabase
          .from("studio_appointments")
          .update({
            client_id: clientId,
            service_id: serviceId || null,
            service_name: serviceName,
            total_amount: totalAmount,
            deposit_amount: depositAmount,
            received_amount: depositAmount,
            scheduled_date: date,
            scheduled_time: time || null,
          })
          .eq("id", editing.id)
          .eq("household_id", household.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("studio_appointments")
          .insert({
            household_id: household.id,
            created_by: user.id,
            client_id: clientId,
            service_id: serviceId || null,
            service_name: serviceName,
            total_amount: totalAmount,
            deposit_amount: depositAmount,
            received_amount: depositAmount,
            scheduled_date: date,
            scheduled_time: time || null,
            status: "agendado",
          });

        if (error) throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ["studio-appointments"],
      });

      closeForm();
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(appointment: Appointment) {
    const confirmed = window.confirm(
      "Excluir este agendamento?"
    );

    if (!confirmed || !household?.id) return;

    try {
      const { error } = await supabase
        .from("studio_appointments")
        .delete()
        .eq("id", appointment.id)
        .eq("household_id", household.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["studio-appointments"],
      });
    } catch (error) {
      console.error(error);
      alert("Não foi possível excluir o agendamento.");
    }
  }

  function openWhatsApp(appointment: Appointment) {
    const client = Array.isArray(appointment.studio_clients)
      ? appointment.studio_clients[0]
      : appointment.studio_clients;

    if (!client?.phone) {
      alert("Cadastre o WhatsApp da cliente primeiro.");
      return;
    }

    const phone = client.phone.replace(/\D/g, "");
    const remaining =
      Number(appointment.total_amount) -
      Number(appointment.received_amount);

    const dateFormatted = new Date(
      `${appointment.scheduled_date}T12:00:00`
    ).toLocaleDateString("pt-BR");

    const message = `Olá, ${client.name}! 💕\n\nAqui é o Studio Lary Andrade.\n\nGostaríamos de confirmar seu agendamento:\n📅 Data: ${dateFormatted}\n⏰ Horário: ${
      appointment.scheduled_time?.slice(0, 5) ?? "a confirmar"
    }\n✨ Serviço: ${appointment.service_name}\n💰 Valor: R$ ${formatMoney(
      Number(appointment.total_amount)
    )}\nSinal: R$ ${formatMoney(
      Number(appointment.received_amount)
    )}\nRestante: R$ ${formatMoney(remaining)}\n\nPedimos, por favor, que chegue 10 minutos antes do horário agendado.\n\nSerá um prazer receber você! 💕\nStudio Lary Andrade`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  }

  return (
    <AppShell
      title="Agenda"
      subtitle="Seus próximos atendimentos"
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
          className="flex size-9 items-center justify-center rounded-full text-[#817b7d] hover:bg-[#f7f3f4]"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-5" strokeWidth={1.6} />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-[#211f20]">
            {monthLabel}
          </p>

          <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[#9b9597]">
            {appointments.length}{" "}
            {appointments.length === 1
              ? "atendimento"
              : "atendimentos"}
          </p>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="flex size-9 items-center justify-center rounded-full text-[#817b7d] hover:bg-[#f7f3f4]"
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-5" strokeWidth={1.6} />
        </button>
      </div>

      <section className="mt-6">
        {isLoading ? (
          <div className="rounded-2xl border border-black/[0.05] bg-white px-4 py-8 text-center text-sm text-[#817b7d]">
            Carregando agenda...
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState text={`Nenhum atendimento em ${monthLabel}.`} />
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const client = Array.isArray(
                appointment.studio_clients
              )
                ? appointment.studio_clients[0]
                : appointment.studio_clients;

              const remaining =
                Number(appointment.total_amount) -
                Number(appointment.received_amount);

              const dateFormatted = new Date(
                `${appointment.scheduled_date}T12:00:00`
              ).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              });

              return (
                <article
                  key={appointment.id}
                  className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#f3e5e8] text-[#9d6875]">
                      <span className="text-[9px] font-medium uppercase">
                        {new Date(
                          `${appointment.scheduled_date}T12:00:00`
                        ).toLocaleDateString("pt-BR", {
                          weekday: "short",
                        })}
                      </span>

                      <span className="text-base font-semibold leading-none">
                        {new Date(
                          `${appointment.scheduled_date}T12:00:00`
                        ).getDate()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#211f20]">
                            {client?.name ?? "Cliente"}
                          </p>

                          <p className="mt-1 truncate text-xs text-[#817b7d]">
                            {appointment.service_name}
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-semibold text-[#211f20]">
                          R${" "}
                          {formatMoney(
                            Number(appointment.total_amount)
                          )}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#817b7d]">
                        <span className="flex items-center gap-1">
                          <CalendarDays
                            className="size-3.5"
                            strokeWidth={1.6}
                          />
                          {dateFormatted}
                        </span>

                        {appointment.scheduled_time && (
                          <span className="flex items-center gap-1">
                            <Clock3
                              className="size-3.5"
                              strokeWidth={1.6}
                            />
                            {appointment.scheduled_time.slice(0, 5)}
                          </span>
                        )}

                        <span className="text-[#9d6875]">
                          Restante R${" "}
                          {formatMoney(remaining)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/[0.05] pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        openWhatsApp(appointment)
                      }
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
                      onClick={() => openEdit(appointment)}
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
                      onClick={() =>
                        deleteAppointment(appointment)
                      }
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] text-xs font-medium text-[#8d696f]"
                    >
                      <Trash2
                        className="size-3.5"
                        strokeWidth={1.7}
                      />
                      Excluir
                    </button>
                  </div>
                </article>
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
                    ? "Editar agendamento"
                    : "Novo agendamento"}
                </h2>

                <p className="mt-1 text-xs text-[#817b7d]">
                  Preencha cliente, serviço e pagamento.
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
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#aaa5a6]" />

                <select
                  value={clientId}
                  onChange={(event) =>
                    setClientId(event.target.value)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 pl-11 pr-10 text-sm outline-none focus:border-[#b7838e]/50"
                >
                  <option value="">Selecione a cliente</option>

                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#aaa5a6]" />
              </div>

              <div className="relative">
                <select
                  value={serviceId}
                  onChange={(event) =>
                    handleServiceChange(event.target.value)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 pr-10 text-sm outline-none focus:border-[#b7838e]/50"
                >
                  <option value="">Selecione o serviço</option>

                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#aaa5a6]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={total}
                  onChange={(event) =>
                    setTotal(event.target.value)
                  }
                  placeholder="Valor total"
                  inputMode="decimal"
                  className="h-11 rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
                />

                <input
                  value={deposit}
                  onChange={(event) =>
                    setDeposit(event.target.value)
                  }
                  placeholder="Sinal"
                  inputMode="decimal"
                  className="h-11 rounded-xl border border-black/[0.07] bg-[#faf9f8] px-4 text-sm outline-none focus:border-[#b7838e]/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={date}
                  onChange={(event) =>
                    setDate(event.target.value)
                  }
                  className="h-11 rounded-xl border border-black/[0.07] bg-[#faf9f8] px-3 text-sm outline-none focus:border-[#b7838e]/50"
                />

                <input
                  type="time"
                  value={time}
                  onChange={(event) =>
                    setTime(event.target.value)
                  }
                  className="h-11 rounded-xl border border-black/[0.07] bg-[#faf9f8] px-3 text-sm outline-none focus:border-[#b7838e]/50"
                />
              </div>

              <button
                type="button"
                disabled={
                  saving ||
                  !clientId ||
                  !serviceName ||
                  !date ||
                  !total
                }
                onClick={saveAppointment}
                className="h-11 w-full rounded-xl bg-[#b7838e] text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : editing
                    ? "Salvar alterações"
                    : "Agendar atendimento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
