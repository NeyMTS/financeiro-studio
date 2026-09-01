import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
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

type Service = {
  id: string;
  name: string;
  default_price: number;
};

type ServiceMetadata = {
  category: string;
  duration_minutes: number;
};

type ServiceMetadataMap = Record<string, ServiceMetadata>;

const METADATA_KEY_PREFIX = "studio-services-metadata-";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const SLOT_MINUTES = 30;

function getMetadataKey(householdId: string) {
  return `${METADATA_KEY_PREFIX}${householdId}`;
}

function loadServiceMetadata(
  householdId?: string
): ServiceMetadataMap {
  if (!householdId || typeof window === "undefined") {
    return {};
  }

  try {
    const saved = localStorage.getItem(
      getMetadataKey(householdId)
    );

    if (!saved) return {};

    return JSON.parse(saved) as ServiceMetadataMap;
  } catch {
    return {};
  }
}

function formatDuration(minutes: number) {
  if (!minutes) return "1h";

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

function timeToMinutes(time: string | null) {
  if (!time) return null;

  const [hours, minutes] = time
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    mins
  ).padStart(2, "0")}`;
}

function dateToKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getClient(
  appointment: Appointment
) {
  return Array.isArray(
    appointment.studio_clients
  )
    ? appointment.studio_clients[0]
    : appointment.studio_clients;
}

function AgendaPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const today = new Date();

  const [selectedMonth, setSelectedMonth] =
    useState(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

  const [viewMode, setViewMode] =
    useState<"dia" | "mes">("dia");

  const [selectedDay, setSelectedDay] =
    useState(dateToKey(today));

  const [showForm, setShowForm] =
    useState(false);

  const [editing, setEditing] =
    useState<Appointment | null>(null);

  const [clientId, setClientId] =
    useState("");

  const [serviceId, setServiceId] =
    useState("");

  const [serviceName, setServiceName] =
    useState("");

  const [total, setTotal] =
    useState("");

  const [deposit, setDeposit] =
    useState("");

  const [date, setDate] =
    useState(dateToKey(today));

  const [time, setTime] =
    useState("");

  const [duration, setDuration] =
    useState(60);

  const [saving, setSaving] =
    useState(false);

  const serviceMetadata =
    useMemo(
      () =>
        loadServiceMetadata(
          household?.id
        ),
      [household?.id]
    );

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
    ).padStart(2, "0")}-${String(
      end.getDate()
    ).padStart(2, "0")}`;
  }, [selectedMonth]);

  const monthLabel =
    selectedMonth.toLocaleDateString(
      "pt-BR",
      {
        month: "long",
        year: "numeric",
      }
    );

  const { data: clients = [] } =
    useQuery({
      queryKey: [
        "studio-clients",
        household?.id,
      ],
      enabled: Boolean(
        household?.id
      ),
      queryFn: async () => {
        const { data, error } =
          await supabase
            .from("studio_clients")
            .select(
              "id, name, phone"
            )
            .eq(
              "household_id",
              household!.id
            )
            .order("name");

        if (error) throw error;

        return data ?? [];
      },
    });

  const { data: services = [] } =
    useQuery({
      queryKey: [
        "studio-services",
        household?.id,
      ],
      enabled: Boolean(
        household?.id
      ),
      queryFn: async () => {
        const { data, error } =
          await supabase
            .from("studio_services")
            .select(
              "id, name, default_price"
            )
            .eq(
              "household_id",
              household!.id
            )
            .eq("active", true)
            .order("name");

        if (error) throw error;

        return (data ??
          []) as Service[];
      },
    });

  const {
    data: appointments = [],
    isLoading,
  } = useQuery({
    queryKey: [
      "studio-appointments",
      household?.id,
      monthStart,
      monthEnd,
    ],
    enabled: Boolean(
      household?.id
    ),
    queryFn: async () => {
      const { data, error } =
        await supabase
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
          .eq(
            "household_id",
            household!.id
          )
          .gte(
            "scheduled_date",
            monthStart
          )
          .lte(
            "scheduled_date",
            monthEnd
          )
          .neq(
            "status",
            "cancelado"
          )
          .order(
            "scheduled_date",
            {
              ascending: true,
            }
          )
          .order(
            "scheduled_time",
            {
              ascending: true,
            }
          );

      if (error) throw error;

      return (data ??
        []) as Appointment[];
    },
  });

  const selectedDayAppointments =
    useMemo(
      () =>
        appointments
          .filter(
            (appointment) =>
              appointment.scheduled_date ===
              selectedDay
          )
          .sort((a, b) => {
            const aTime =
              timeToMinutes(
                a.scheduled_time
              ) ?? 0;

            const bTime =
              timeToMinutes(
                b.scheduled_time
              ) ?? 0;

            return aTime - bTime;
          }),
      [appointments, selectedDay]
    );

  function parseMoney(
    value: string
  ) {
    return (
      Number(
        value
          .replace(/\./g, "")
          .replace(",", ".")
      ) || 0
    );
  }

  function formatMoney(
    value: number
  ) {
    return value.toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function getDuration(
    appointment: Appointment
  ) {
    if (
      appointment.service_id &&
      serviceMetadata[
        appointment.service_id
      ]
    ) {
      return (
        serviceMetadata[
          appointment.service_id
        ].duration_minutes || 60
      );
    }

    const matchingService =
      services.find(
        (service) =>
          service.id ===
          appointment.service_id
      );

    if (
      matchingService &&
      serviceMetadata[
        matchingService.id
      ]
    ) {
      return (
        serviceMetadata[
          matchingService.id
        ].duration_minutes || 60
      );
    }

    return 60;
  }

  function getServiceDuration(
    id: string
  ) {
    return (
      serviceMetadata[id]
        ?.duration_minutes || 60
    );
  }

  function previousMonth() {
    const next = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() - 1,
      1
    );

    setSelectedMonth(next);
    setSelectedDay(
      dateToKey(next)
    );
  }

  function nextMonth() {
    const next = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      1
    );

    setSelectedMonth(next);
    setSelectedDay(
      dateToKey(next)
    );
  }

  function goToToday() {
    const current =
      new Date();

    setSelectedMonth(
      new Date(
        current.getFullYear(),
        current.getMonth(),
        1
      )
    );

    setSelectedDay(
      dateToKey(current)
    );
  }

  function openNew(
    dateValue?: string,
    timeValue?: string
  ) {
    const appointmentDate =
      dateValue ??
      selectedDay ??
      dateToKey(today);

    setEditing(null);
    setClientId("");
    setServiceId("");
    setServiceName("");
    setTotal("");
    setDeposit("");
    setDate(
      appointmentDate
    );
    setTime(
      timeValue ?? ""
    );
    setDuration(60);
    setShowForm(true);
  }

  function openEdit(
    appointment: Appointment
  ) {
    setEditing(appointment);
    setClientId(
      appointment.client_id ?? ""
    );
    setServiceId(
      appointment.service_id ?? ""
    );
    setServiceName(
      appointment.service_name
    );
    setTotal(
      formatMoney(
        Number(
          appointment.total_amount
        )
      )
    );
    setDeposit(
      formatMoney(
        Number(
          appointment.deposit_amount
        )
      )
    );
    setDate(
      appointment.scheduled_date
    );
    setTime(
      appointment.scheduled_time
        ?.slice(0, 5) ?? ""
    );
    setDuration(
      getDuration(
        appointment
      )
    );
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditing(null);
  }

  function handleServiceChange(
    id: string
  ) {
    setServiceId(id);

    const service =
      services.find(
        (item) =>
          item.id === id
      );

    if (!service) return;

    setServiceName(
      service.name
    );

    setTotal(
      formatMoney(
        Number(
          service.default_price
        )
      )
    );

    setDuration(
      getServiceDuration(id)
    );
  }

  function hasConflict(
    startTime: string,
    appointmentDate: string,
    appointmentDuration: number,
    ignoreId?: string
  ) {
    const newStart =
      timeToMinutes(
        startTime
      );

    if (
      newStart === null
    ) {
      return false;
    }

    const newEnd =
      newStart +
      appointmentDuration;

    return appointments.some(
      (appointment) => {
        if (
          appointment.id ===
          ignoreId
        ) {
          return false;
        }

        if (
          appointment.scheduled_date !==
          appointmentDate
        ) {
          return false;
        }

        if (
          !appointment.scheduled_time
        ) {
          return false;
        }

        const existingStart =
          timeToMinutes(
            appointment.scheduled_time
          );

        if (
          existingStart ===
          null
        ) {
          return false;
        }

        const existingEnd =
          existingStart +
          getDuration(
            appointment
          );

        return (
          newStart <
            existingEnd &&
          newEnd >
            existingStart
        );
      }
    );
  }

  async function saveAppointment() {
    if (
      !household?.id ||
      !clientId ||
      !serviceName ||
      !date ||
      !total ||
      !time
    ) {
      alert(
        "Preencha cliente, serviço, data, horário e valor."
      );
      return;
    }

    if (
      hasConflict(
        time,
        date,
        duration,
        editing?.id
      )
    ) {
      alert(
        "Este horário já está ocupado por outro atendimento. Escolha outro horário."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Usuário não autenticado."
        );
      }

      const totalAmount =
        parseMoney(total);

      const depositAmount =
        Math.min(
          parseMoney(deposit),
          totalAmount
        );

      if (editing) {
        const { error } =
          await supabase
            .from(
              "studio_appointments"
            )
            .update({
              client_id:
                clientId,
              service_id:
                serviceId || null,
              service_name:
                serviceName,
              total_amount:
                totalAmount,
              deposit_amount:
                depositAmount,
              received_amount:
                depositAmount,
              scheduled_date:
                date,
              scheduled_time:
                time,
            })
            .eq(
              "id",
              editing.id
            )
            .eq(
              "household_id",
              household.id
            );

        if (error) throw error;
      } else {
        const { error } =
          await supabase
            .from(
              "studio_appointments"
            )
            .insert({
              household_id:
                household.id,
              created_by:
                user.id,
              client_id:
                clientId,
              service_id:
                serviceId || null,
              service_name:
                serviceName,
              total_amount:
                totalAmount,
              deposit_amount:
                depositAmount,
              received_amount:
                depositAmount,
              scheduled_date:
                date,
              scheduled_time:
                time,
              status:
                "agendado",
            });

        if (error) throw error;
      }

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "studio-appointments",
          ],
        }
      );

      setSelectedDay(date);

      setSelectedMonth(
        new Date(
          `${date}T12:00:00`
        )
      );

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

  async function deleteAppointment(
    appointment: Appointment
  ) {
    const confirmed =
      window.confirm(
        "Excluir este agendamento?"
      );

    if (
      !confirmed ||
      !household?.id
    ) {
      return;
    }

    try {
      const { error } =
        await supabase
          .from(
            "studio_appointments"
          )
          .delete()
          .eq(
            "id",
            appointment.id
          )
          .eq(
            "household_id",
            household.id
          );

      if (error) throw error;

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "studio-appointments",
          ],
        }
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o agendamento."
      );
    }
  }

  function openWhatsApp(
    appointment: Appointment
  ) {
    const client =
      getClient(appointment);

    if (!client?.phone) {
      alert(
        "Cadastre o WhatsApp da cliente primeiro."
      );
      return;
    }

    const phone =
      client.phone.replace(
        /\D/g,
        ""
      );

    const dateFormatted =
      new Date(
        `${appointment.scheduled_date}T12:00:00`
      ).toLocaleDateString(
        "pt-BR"
      );

    const message =
      `Olá, ${client.name}! 💕\n\n` +
      `Gostaríamos de confirmar seu agendamento:\n` +
      `📅 Data: ${dateFormatted}\n` +
      `⏰ Horário: ${
        appointment.scheduled_time?.slice(
          0,
          5
        ) ?? "a confirmar"
      }\n` +
      `✨ Serviço: ${appointment.service_name}\n\n` +
      `Pedimos, por favor, que chegue 5 minutos antes do horário agendado.\n\n` +
      `Será um prazer receber você!\n` +
      `Studio Lary Andrade`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(
        message
      )}`,
      "_blank"
    );
  }

  async function finalizeAppointment(
    appointment: Appointment
  ) {
    if (!household?.id) return;

    const confirmed =
      window.confirm(
        `Finalizar o atendimento de ${getClient(appointment)?.name ?? "cliente"} e marcar como pago?`
      );

    if (!confirmed) return;

    try {
      const { error } =
        await supabase
          .from(
            "studio_appointments"
          )
          .update({
            status:
              "concluido",
            received_amount:
              Number(
                appointment.total_amount
              ),
          })
          .eq(
            "id",
            appointment.id
          )
          .eq(
            "household_id",
            household.id
          );

      if (error) throw error;

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "studio-appointments",
          ],
        }
      );

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "studio-finance",
          ],
        }
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar o atendimento."
      );
    }
  }

  return (
    <AppShell
      title="Agenda"
      subtitle="Seus próximos atendimentos"
      action={
        <button
          type="button"
          onClick={() =>
            openNew()
          }
          className="flex size-10 items-center justify-center rounded-full bg-[#b7838e] text-white shadow-sm active:scale-95"
          aria-label="Novo agendamento"
        >
          <Plus
            className="size-4.5"
            strokeWidth={1.9}
          />
        </button>
      }
    >
      {/* CABEÇALHO */}
      <div className="rounded-2xl border border-black/[0.05] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={
              previousMonth
            }
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
            onClick={
              goToToday
            }
            className="text-center"
          >
            <p className="text-sm font-semibold capitalize text-[#211f20]">
              {monthLabel}
            </p>

            <p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-[#aaa5a6]">
              {appointments.length}{" "}
              {appointments.length ===
              1
                ? "atendimento"
                : "atendimentos"}
            </p>
          </button>

          <button
            type="button"
            onClick={
              nextMonth
            }
            className="flex size-9 items-center justify-center rounded-full text-[#817b7d] hover:bg-[#f7f3f4]"
            aria-label="Próximo mês"
          >
            <ChevronRight
              className="size-5"
              strokeWidth={1.6}
            />
          </button>
        </div>

        {/* VISÕES */}
        <div className="mt-3 flex rounded-xl bg-[#f3e5e8] p-1">
          <button
            type="button"
            onClick={() =>
              setViewMode(
                "dia"
              )
            }
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              viewMode ===
              "dia"
                ? "bg-white text-[#9d6875] shadow-sm"
                : "text-[#817b7d]"
            }`}
          >
            Dia
          </button>

          <button
            type="button"
            onClick={() =>
              setViewMode(
                "mes"
              )
            }
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              viewMode ===
              "mes"
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
        ) : viewMode ===
          "mes" ? (
          <MonthCalendar
            selectedMonth={
              selectedMonth
            }
            appointments={
              appointments
            }
            onSelectDate={(
              dateValue
            ) => {
              setSelectedDay(
                dateValue
              );

              setViewMode(
                "dia"
              );
            }}
          />
        ) : (
          <DaySchedule
            selectedDay={
              selectedDay
            }
            appointments={
              selectedDayAppointments
            }
            getDuration={
              getDuration
            }
            onSelectTime={(
              timeValue
            ) =>
              openNew(
                selectedDay,
                timeValue
              )
            }
            onEdit={
              openEdit
            }
            onDelete={
              deleteAppointment
            }
            onWhatsApp={
              openWhatsApp
            }
            onFinalize={
              finalizeAppointment
            }
          />
        )}
      </section>

      {/* MODAL */}
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
                onClick={
                  closeForm
                }
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
                    value={
                      clientId
                    }
                    onChange={(
                      event
                    ) =>
                      setClientId(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-black/[0.08] bg-white pl-10 pr-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                  >
                    <option value="">
                      Selecione a cliente
                    </option>

                    {clients.map(
                      (
                        client
                      ) => (
                        <option
                          key={
                            client.id
                          }
                          value={
                            client.id
                          }
                        >
                          {
                            client.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* SERVIÇO */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Serviço
                </label>

                <select
                  value={
                    serviceId
                  }
                  onChange={(
                    event
                  ) =>
                    handleServiceChange(
                      event
                        .target
                        .value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                >
                  <option value="">
                    Selecione o serviço
                  </option>

                  {services.map(
                    (
                      service
                    ) => (
                      <option
                        key={
                          service.id
                        }
                        value={
                          service.id
                        }
                      >
                        {
                          service.name
                        }{" "}
                        — R${" "}
                        {formatMoney(
                          Number(
                            service.default_price
                          )
                        )}{" "}
                        ·{" "}
                        {formatDuration(
                          getServiceDuration(
                            service.id
                          )
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* DURAÇÃO */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Duração do atendimento
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    30,
                    45,
                    60,
                    90,
                    120,
                    180,
                  ].map(
                    (
                      value
                    ) => (
                      <button
                        key={
                          value
                        }
                        type="button"
                        onClick={() =>
                          setDuration(
                            value
                          )
                        }
                        className={`rounded-xl border py-2.5 text-xs font-medium ${
                          duration ===
                          value
                            ? "border-[#b7838e] bg-[#f3e5e8] text-[#9d6875]"
                            : "border-black/[0.06] bg-white text-[#817b7d]"
                        }`}
                      >
                        {formatDuration(
                          value
                        )}
                      </button>
                    )
                  )}
                </div>

                <p className="mt-2 text-[10px] text-[#aaa5a6]">
                  A duração do serviço já é carregada automaticamente. Ajuste somente se necessário neste atendimento.
                </p>
              </div>

              {/* VALOR */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Valor do atendimento
                </label>

                <input
                  value={
                    total
                  }
                  onChange={(
                    event
                  ) =>
                    setTotal(
                      event
                        .target
                        .value
                    )
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
                  value={
                    deposit
                  }
                  onChange={(
                    event
                  ) =>
                    setDeposit(
                      event
                        .target
                        .value
                    )
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
                    value={
                      date
                    }
                    onChange={(
                      event
                    ) =>
                      setDate(
                        event
                          .target
                          .value
                      )
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
                    value={
                      time
                    }
                    onChange={(
                      event
                    ) =>
                      setTime(
                        event
                          .target
                          .value
                      )
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
                      {formatMoney(
                        parseMoney(
                          total
                        )
                      )}
                    </strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[#817b7d]">
                      Recebido
                    </span>

                    <strong className="text-sm text-[#9d6875]">
                      R${" "}
                      {formatMoney(
                        parseMoney(
                          deposit
                        )
                      )}
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
                          parseMoney(
                            total
                          ) -
                            parseMoney(
                              deposit
                            )
                        )
                      )}
                    </strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[#817b7d]">
                      Tempo ocupado
                    </span>

                    <strong className="text-xs text-[#9d6875]">
                      {formatDuration(
                        duration
                      )}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={
                saveAppointment
              }
              disabled={
                saving
              }
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

function DaySchedule({
  selectedDay,
  appointments,
  getDuration,
  onSelectTime,
  onEdit,
  onDelete,
  onWhatsApp,
  onFinalize,
}: {
  selectedDay: string;
  appointments: Appointment[];
  getDuration: (
    appointment: Appointment
  ) => number;
  onSelectTime: (
    time: string
  ) => void;
  onEdit: (
    appointment: Appointment
  ) => void;
  onDelete: (
    appointment: Appointment
  ) => void;
  onWhatsApp: (
    appointment: Appointment
  ) => void;
  onFinalize: (
    appointment: Appointment
  ) => void;
}) {
  const selectedDate =
    new Date(
      `${selectedDay}T12:00:00`
    );

  const dateLabel =
    selectedDate.toLocaleDateString(
      "pt-BR",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }
    );

  const occupiedSlots =
    new Set<number>();

  appointments.forEach(
    (appointment) => {
      const start =
        timeToMinutes(
          appointment.scheduled_time
        );

      if (
        start === null
      ) {
        return;
      }

      const duration =
        getDuration(
          appointment
        );

      const end =
        start + duration;

      for (
        let minute = start;
        minute < end;
        minute += SLOT_MINUTES
      ) {
        occupiedSlots.add(
          minute
        );
      }
    }
  );

  const slots: number[] = [];

  for (
    let minute =
      DAY_START_HOUR * 60;
    minute <=
      DAY_END_HOUR * 60;
    minute += SLOT_MINUTES
  ) {
    slots.push(minute);
  }

  function appointmentAt(
    minute: number
  ) {
    return appointments.find(
      (appointment) => {
        const start =
          timeToMinutes(
            appointment.scheduled_time
          );

        return (
          start !== null &&
          start === minute
        );
      }
    );
  }

  return (
    <div>
      {/* DIA */}
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#f3e5e8] px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#9d6875]">
            Agenda do dia
          </p>

          <p className="mt-1 text-sm font-semibold capitalize text-[#211f20]">
            {dateLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onSelectTime(
              "09:00"
            )
          }
          className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#9d6875]"
        >
          <Plus
            className="size-3.5"
            strokeWidth={1.8}
          />
          Agendar
        </button>
      </div>

      {/* HORÁRIOS */}
      <div className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white shadow-sm">
        {slots.map(
          (minute) => {
            const appointment =
              appointmentAt(
                minute
              );

            const occupied =
              occupiedSlots.has(
                minute
              );

            if (
              appointment
            ) {
              const client =
                getClient(
                  appointment
                );

              const duration =
                getDuration(
                  appointment
                );

              const remaining =
                Number(
                  appointment.total_amount
                ) -
                Number(
                  appointment.received_amount
                );

              return (
                <div
                  key={minute}
                  className="border-b border-black/[0.05] last:border-b-0"
                >
                  <div className="flex min-h-[74px]">
                    <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 pt-3 text-center">
                      <span className="text-xs font-semibold text-[#817b7d]">
                        {minutesToTime(
                          minute
                        )}
                      </span>
                    </div>

                    <div className="flex-1 p-2">
                      <div className="rounded-xl border border-[#b7838e]/20 bg-[#f3e5e8] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#211f20]">
                              {client?.name ??
                                "Cliente"}
                            </p>

                            <p className="mt-1 truncate text-xs text-[#817b7d]">
                              {
                                appointment.service_name
                              }
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] text-[#817b7d]">
                                <Clock3
                                  className="size-3"
                                  strokeWidth={
                                    1.6
                                  }
                                />
                                {formatDuration(
                                  duration
                                )}
                              </span>

                              <span className="text-[10px] text-[#9d6875]">
                                R${" "}
                                {Number(
                                  appointment.total_amount
                                ).toLocaleString(
                                  "pt-BR",
                                  {
                                    minimumFractionDigits: 2,
                                  }
                                )}
                              </span>
                            </div>
                          </div>

                          {appointment.status ===
                            "concluido" ? (
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#b7838e] text-white">
                              <Check
                                className="size-4"
                                strokeWidth={
                                  2
                                }
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onFinalize(
                                  appointment
                                )
                              }
                              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#9d6875] shadow-sm"
                              aria-label="Finalizar atendimento"
                            >
                              <Check
                                className="size-4"
                                strokeWidth={
                                  1.8
                                }
                              />
                            </button>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-[#b7838e]/15 pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              onWhatsApp(
                                appointment
                              )
                            }
                            className="flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-[10px] font-medium text-[#9d6875]"
                          >
                            <MessageCircle
                              className="size-3"
                              strokeWidth={
                                1.7
                              }
                            />
                            WhatsApp
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onEdit(
                                appointment
                              )
                            }
                            className="flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-[10px] font-medium text-[#625d5f]"
                          >
                            <Pencil
                              className="size-3"
                              strokeWidth={
                                1.7
                              }
                            />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onDelete(
                                appointment
                              )
                            }
                            className="flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-[10px] font-medium text-[#b56f6f]"
                          >
                            <Trash2
                              className="size-3"
                              strokeWidth={
                                1.7
                              }
                            />
                            Excluir
                          </button>
                        </div>

                        {remaining >
                          0 &&
                          appointment.status !==
                            "concluido" && (
                            <p className="mt-2 text-[9px] text-[#9d6875]">
                              A receber: R${" "}
                              {remaining.toLocaleString(
                                "pt-BR",
                                {
                                  minimumFractionDigits: 2,
                                }
                              )}
                            </p>
                          )}
                      </div>
                    </div>
                  </div>

                  {duration >
                    SLOT_MINUTES && (
                    <div className="flex min-h-[35px] border-t border-[#b7838e]/10 bg-[#faf7f7]">
                      <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 py-2 text-center text-[9px] text-[#aaa5a6]">
                        até
                      </div>

                      <div className="flex items-center px-3 text-[9px] text-[#aaa5a6]">
                        {minutesToTime(
                          minute +
                            duration
                        )}{" "}
                        • horário ocupado
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            const previousAppointment =
              appointments.find(
                (appointment) => {
                  const start =
                    timeToMinutes(
                      appointment.scheduled_time
                    );

                  if (
                    start ===
                    null
                  ) {
                    return false;
                  }

                  const end =
                    start +
                    getDuration(
                      appointment
                    );

                  return (
                    minute >
                      start &&
                    minute <
                      end
                  );
                }
              );

            if (
              previousAppointment
            ) {
              return (
                <div
                  key={minute}
                  className="flex min-h-[46px] border-b border-black/[0.04] bg-[#faf9f8]"
                >
                  <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 py-3 text-center text-[10px] text-[#aaa5a6]">
                    {minutesToTime(
                      minute
                    )}
                  </div>

                  <div className="flex flex-1 items-center px-3 text-[10px] text-[#aaa5a6]">
                    Horário ocupado por{" "}
                    {
                      getClient(
                        previousAppointment
                      )?.name
                    }
                  </div>
                </div>
              );
            }

            return (
              <button
                key={minute}
                type="button"
                onClick={() =>
                  onSelectTime(
                    minutesToTime(
                      minute
                    )
                  )
                }
                disabled={
                  occupied
                }
                className="flex min-h-[54px] w-full border-b border-black/[0.04] text-left transition active:bg-[#f8eef0] disabled:cursor-not-allowed"
              >
                <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 py-3 text-center text-[10px] font-medium text-[#817b7d]">
                  {minutesToTime(
                    minute
                  )}
                </div>

                <div className="flex flex-1 items-center px-3">
                  <span className="text-[10px] text-[#c1bbbc]">
                    Horário livre
                  </span>
                </div>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

function MonthCalendar({
  selectedMonth,
  appointments,
  onSelectDate,
}: {
  selectedMonth: Date;
  appointments: Appointment[];
  onSelectDate: (
    date: string
  ) => void;
}) {
  const year =
    selectedMonth.getFullYear();

  const month =
    selectedMonth.getMonth();

  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  const totalCells =
    Math.ceil(
      (firstDay +
        daysInMonth) /
        7
    ) * 7;

  const cells =
    Array.from(
      {
        length:
          totalCells,
      },
      (_, index) => {
        const day =
          index -
          firstDay +
          1;

        return day >=
          1 &&
          day <=
            daysInMonth
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

  function dateKey(
    day: number
  ) {
    return `${year}-${String(
      month + 1
    ).padStart(
      2,
      "0"
    )}-${String(
      day
    ).padStart(
      2,
      "0"
    )}`;
  }

  const todayKey =
    dateToKey(
      new Date()
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-black/[0.05]">
        {weekdays.map(
          (
            weekday,
            index
          ) => (
            <div
              key={`${weekday}-${index}`}
              className="py-3 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[#aaa5a6]"
            >
              {weekday}
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-7">
        {cells.map(
          (
            day,
            index
          ) => {
            if (!day) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[100px] border-b border-r border-black/[0.04] bg-[#faf9f8]"
                />
              );
            }

            const key =
              dateKey(day);

            const dayAppointments =
              appointments
                .filter(
                  (
                    appointment
                  ) =>
                    appointment.scheduled_date ===
                    key
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    (timeToMinutes(
                      a.scheduled_time
                    ) ??
                      0) -
                    (timeToMinutes(
                      b.scheduled_time
                    ) ??
                      0)
                );

            const isToday =
              key ===
              todayKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onSelectDate(
                    key
                  )
                }
                className="min-h-[100px] border-b border-r border-black/[0.04] p-1.5 text-left transition active:bg-[#f8eef0]"
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
                    .slice(
                      0,
                      3
                    )
                    .map(
                      (
                        appointment
                      ) => {
                        const client =
                          getClient(
                            appointment
                          );

                        return (
                          <div
                            key={
                              appointment.id
                            }
                            className={`truncate rounded-md px-1.5 py-1 text-[8px] font-medium leading-none ${
                              appointment.status ===
                              "concluido"
                                ? "bg-[#e9e1e3] text-[#817b7d]"
                                : "bg-[#f3e5e8] text-[#9d6875]"
                            }`}
                          >
                            {
                              client?.name ??
                              "Cliente"
                            }
                          </div>
                        );
                      }
                    )}

                  {dayAppointments.length >
                    3 && (
                    <p className="px-1 text-[8px] font-medium text-[#aaa5a6]">
                      +
                      {dayAppointments.length -
                        3}{" "}
                      mais
                    </p>
                  )}
                </div>
              </button>
            );
          }
        )}
      </div>

      <div className="border-t border-black/[0.05] px-4 py-3 text-center text-[9px] uppercase tracking-[0.12em] text-[#aaa5a6]">
        Toque em um dia para abrir os horários
      </div>
    </div>
  );
}
