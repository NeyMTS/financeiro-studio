import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
  client_id: string | null;
  service_id: string | null;
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

  const [viewMode, setViewMode] = useState<"lista" | "mes">("lista");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
          client_id,
          service_id,
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

  const visibleAppointments = useMemo(() => {
    if (!selectedDay) return appointments;

    return appointments.filter(
      (appointment) => appointment.scheduled_date === selectedDay
    );
  }, [appointments, selectedDay]);

  function parseMoney(value: string) {
    return (
      Number(value.replace(/\./g, "").replace(",", ".")) || 0
    );
  }

  function formatMoney(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
    setSelectedDay(null);
  }

  function nextMonth() {
    setSelectedMonth(
      new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        1
      )
    );
    setSelectedDay(null);
  }

  function goToToday() {
    const current = new Date();

    setSelectedMonth(
      new Date(current.getFullYear(), current.getMonth(), 1)
    );

    setSelectedDay(null);
  }

  function openNew(dateValue?: string) {
    setEditing(null);
    setClientId("");
    setServiceId("");
    setServiceName("");
    setTotal("");
    setDeposit("");
    setDate(
      dateValue ??
        selectedDay ??
        new Date().toISOString().slice(0, 10)
    );
    setTime("");
    setShowForm(true);
  }

  function openEdit(appointment: Appointment) {
    const client = Array.isArray(appointment.studio_clients)
      ? appointment.studio_clients[0]
      : appointment.studio_clients;

    setEditing(appointment);
    setClientId(appointment.client_id ?? "");
    setServiceId(appointment.service_id ?? "");
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
      alert(
        "Preencha cliente, serviço, data e valor do atendimento."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

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

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o agendamento."
      );
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

      alert(error instanceof Error ? error.message : "Não foi possível excluir o agendamento.");
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
      appointment.scheduled_time?.slice(0, 5) ??
      "a confirmar"
    }\n✨ Serviço: ${appointment.service_name}\n💰 Valor: R$ ${formatMoney(
      Number(appointment.total_amount)
    )}\nSinal: R$ ${formatMoney(
      Number(appointment.received_amount)
    )}\nRestante: R$ ${formatMoney(
      remaining
    )}\n\nPedimos, por favor, que chegue 10 minutos antes do horário agendado.\n\nSerá um prazer receber você! 💕\nStudio Lary Andrade`;

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
          onClick={() => openNew()}
          className="flex size-10 items-center justify-center rounded-full bg-[#b7838e] text-white shadow-sm active:scale-95"
          aria-label="Novo agendamento"
        >
          <Plus className="size-4.5" strokeWidth={1.9} />
        </button>
      }
    >
      {/* CABEÇALHO DO MÊS */}
      <div className="rounded-2xl border border-black/[0.05] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={previousMonth}
            className="flex size-9 items-center justify-center rounded-full text-[#817b7d] hover:bg-[#f7f3f4]"
            aria-label="Mês anterior"
          >
            <ChevronLeft
              className="size-5"
              strokeWidth={1.6}
            />
          </button>

          <button
            type="button"
            onClick={goToToday}
            className="text-center"
          >
            <p className="text-sm font-semibold capitalize text-[#211f20]">
              {monthLabel}
            </p>

            <p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-[#aaa5a6]">
              {appointments.length}{" "}
              {appointments.length === 1
                ? "atendimento"
                : "atendimentos"}
            </p>
          </button>

          <button
            type="button"
            onClick={nextMonth}
            className="flex size-9 items-center justify-center rounded-full text-[#817b7d] hover:bg-[#f7f3f4]"
            aria-label="Próximo mês"
          >
            <ChevronRight
              className="size-5"
              strokeWidth={1.6}
            />
          </button>
        </div>

        {/* ALTERNADOR */}
        <div className="mt-3 flex rounded-xl bg-[#f3e5e8] p-1">
          <button
            type="button"
            onClick={() => {
              setViewMode("lista");
              setSelectedDay(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              viewMode === "lista"
                ? "bg-white text-[#9d6875] shadow-sm"
                : "text-[#817b7d]"
            }`}
          >
            Lista
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode("mes");
              setSelectedDay(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              viewMode === "mes"
                ? "bg-white text-[#9d6875] shadow-sm"
                : "text-[#817b7d]"
            }`}
          >
            Mês
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <section className="mt-5">
        {isLoading ? (
          <div className="rounded-2xl border border-black/[0.05] bg-white px-4 py-8 text-center text-sm text-[#817b7d]">
            Carregando agenda...
          </div>
        ) : viewMode === "mes" ? (
          <MonthCalendar
            selectedMonth={selectedMonth}
            appointments={appointments}
            onSelectDate={(dateValue) => {
              setSelectedDay(dateValue);
              setViewMode("lista");
            }}
          />
        ) : (
          <div>
            {selectedDay && (
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#f3e5e8] px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#9d6875]">
                    Atendimentos de
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#211f20]">
                    {new Date(
                      `${selectedDay}T12:00:00`
                    ).toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    })}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="flex size-8 items-center justify-center rounded-full bg-white text-[#9d6875]"
                  aria-label="Mostrar todos"
                >
                  <X
                    className="size-4"
                    strokeWidth={1.7}
                  />
                </button>
              </div>
            )}

            {visibleAppointments.length === 0 ? (
              <div>
                <EmptyState
                  text={
                    selectedDay
                      ? "Nenhum atendimento neste dia."
                      : `Nenhum atendimento em ${monthLabel}.`
                  }
                />

                <button
                  type="button"
                  onClick={() => openNew(selectedDay ?? undefined)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b7838e] py-3 text-sm font-semibold text-white"
                >
                  <Plus
                    className="size-4"
                    strokeWidth={1.8}
                  />
                  Novo atendimento
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAppointments.map((appointment) => {
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
                                Number(
                                  appointment.total_amount
                                )
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
                                {appointment.scheduled_time.slice(
                                  0,
                                  5
                                )}
                              </span>
                            )}

                            <span className="text-[#9d6875]">
                              Restante R${" "}
                              {formatMoney(remaining)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AÇÕES */}
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/[0.05] pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsApp(appointment)
                          }
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-[#f3e5e8] py-2.5 text-xs font-medium text-[#9d6875]"
                        >
                          <MessageCircle
                            className="size-3.5"
                            strokeWidth={1.7}
                          />
                          WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openEdit(appointment)
                          }
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-[#f7f6f5] py-2.5 text-xs font-medium text-[#625d5f]"
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
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-[#fdf2f2] py-2.5 text-xs font-medium text-[#b56f6f]"
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
          </div>
        )}
      </section>

      {/* MODAL DE AGENDAMENTO */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5">
          <div className="w-full max-w-md rounded-t-3xl bg-[#faf9f8] p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#aaa5a6]">
                  Studio Lary Andrade
                </p>

                <h2 className="mt-1 text-xl font-semibold text-[#211f20]">
                  {editing
                    ? "Editar atendimento"
                    : "Novo atendimento"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="flex size-9 items-center justify-center rounded-full bg-white text-[#817b7d]"
                aria-label="Fechar"
              >
                <X
                  className="size-4"
                  strokeWidth={1.7}
                />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto pb-2">
              {/* CLIENTE */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Cliente
                </label>

                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#aaa5a6]"
                    strokeWidth={1.6}
                  />

                  <select
                    value={clientId}
                    onChange={(event) =>
                      setClientId(event.target.value)
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-black/[0.08] bg-white pl-10 pr-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                  >
                    <option value="">
                      Selecione a cliente
                    </option>

                    {clients.map((client) => (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SERVIÇO */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Serviço
                </label>

                <select
                  value={serviceId}
                  onChange={(event) =>
                    handleServiceChange(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                >
                  <option value="">
                    Selecione o serviço
                  </option>

                  {services.map((service) => (
                    <option
                      key={service.id}
                      value={service.id}
                    >
                      {service.name} — R${" "}
                      {formatMoney(
                        Number(service.default_price)
                      )}
                    </option>
                  ))}
                </select>
              </div>

              {/* VALOR */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Valor do atendimento
                </label>

                <input
                  value={total}
                  onChange={(event) =>
                    setTotal(event.target.value)
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                />
              </div>

              {/* SINAL */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Sinal / valor recebido
                </label>

                <input
                  value={deposit}
                  onChange={(event) =>
                    setDeposit(event.target.value)
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                />
              </div>

              {/* DATA E HORA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                    Data
                  </label>

                  <input
                    type="date"
                    value={date}
                    onChange={(event) =>
                      setDate(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                    Horário
                  </label>

                  <input
                    type="time"
                    value={time}
                    onChange={(event) =>
                      setTime(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                  />
                </div>
              </div>

              {/* RESUMO */}
              {total && (
                <div className="rounded-2xl bg-[#f3e5e8] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#817b7d]">
                      Total
                    </span>

                    <strong className="text-sm text-[#211f20]">
                      R${" "}
                      {formatMoney(parseMoney(total))}
                    </strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[#817b7d]">
                      Recebido
                    </span>

                    <strong className="text-sm text-[#9d6875]">
                      R${" "}
                      {formatMoney(parseMoney(deposit))}
                    </strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-[#b7838e]/20 pt-2">
                    <span className="text-xs font-medium text-[#625d5f]">
                      A receber
                    </span>

                    <strong className="text-sm text-[#9d6875]">
                      R${" "}
                      {formatMoney(
                        Math.max(
                          0,
                          parseMoney(total) -
                            parseMoney(deposit)
                        )
                      )}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={saveAppointment}
              disabled={saving}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#b7838e] text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {saving
                ? "Salvando..."
                : editing
                  ? "Salvar alterações"
                  : "Agendar atendimento"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function MonthCalendar({
  selectedMonth,
  appointments,
  onSelectDate,
}: {
  selectedMonth: Date;
  appointments: Appointment[];
  onSelectDate: (date: string) => void;
}) {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const totalCells =
    Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = Array.from(
    { length: totalCells },
    (_, index) => {
      const day = index - firstDay + 1;

      return day >= 1 && day <= daysInMonth
        ? day
        : null;
    }
  );

  const weekdays = [
    "D",
    "S",
    "T",
    "Q",
    "Q",
    "S",
    "S",
  ];

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
  }

  const today = new Date();

  const todayKey = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white shadow-sm">
      {/* DIAS DA SEMANA */}
      <div className="grid grid-cols-7 border-b border-black/[0.05]">
        {weekdays.map((weekday, index) => (
          <div
            key={`${weekday}-${index}`}
            className="py-3 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[#aaa5a6]"
          >
            {weekday}
          </div>
        ))}
      </div>

      {/* CALENDÁRIO */}
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          if (!day) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[82px] border-b border-r border-black/[0.04] bg-[#faf9f8]"
              />
            );
          }

          const key = dateKey(day);

          const dayAppointments = appointments.filter(
            (appointment) =>
              appointment.scheduled_date === key
          );

          const isToday = key === todayKey;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className="min-h-[82px] border-b border-r border-black/[0.04] p-1.5 text-left transition active:bg-[#f8eef0]"
            >
              <div className="flex justify-center">
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-[#b7838e] font-semibold text-white"
                      : "text-[#211f20]"
                  }`}
                >
                  {day}
                </span>
              </div>

              <div className="mt-1 space-y-1">
                {dayAppointments
                  .slice(0, 2)
                  .map((appointment) => {
                    const client = Array.isArray(
                      appointment.studio_clients
                    )
                      ? appointment.studio_clients[0]
                      : appointment.studio_clients;

                    return (
                      <div
                        key={appointment.id}
                        className="truncate rounded-md bg-[#f3e5e8] px-1 py-1 text-[8px] font-medium leading-none text-[#9d6875]"
                      >
                        {appointment.scheduled_time
                          ? `${appointment.scheduled_time.slice(
                              0,
                              5
                            )} `
                          : ""}
                        {client?.name ?? "Cliente"}
                      </div>
                    );
                  })}

                {dayAppointments.length > 2 && (
                  <p className="px-1 text-[8px] font-medium text-[#aaa5a6]">
                    +{dayAppointments.length - 2} mais
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-black/[0.05] px-4 py-3 text-center text-[9px] uppercase tracking-[0.12em] text-[#aaa5a6]">
        Toque em um dia para ver os atendimentos
      </div>
    </div>
  );
}
