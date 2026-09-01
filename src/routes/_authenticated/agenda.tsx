import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock3,
  Plus,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

function AgendaPage() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["studio-clients", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_clients")
        .select("id, name")
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
    queryKey: ["studio-appointments", household?.id],
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
          studio_clients(name)
        `
        )
        .eq("household_id", household!.id)
        .neq("status", "cancelado")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  function parseMoney(value: string) {
    return Number(
      value.replace(/\./g, "").replace(",", ".")
    ) || 0;
  }

  function handleServiceChange(id: string) {
    setServiceId(id);

    const service = services.find((item) => item.id === id);

    if (service) {
      setServiceName(service.name);
      setTotal(
        Number(service.default_price).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })
      );
    }
  }

  async function createAppointment() {
    if (!household?.id || !clientId || !serviceName || !date) return;

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado.");

      const totalAmount = parseMoney(total);
      const depositAmount = parseMoney(deposit);

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

      setClientId("");
      setServiceId("");
      setServiceName("");
      setTotal("");
      setDeposit("");
      setDate("");
      setTime("");
      setShowForm(false);

      await queryClient.invalidateQueries({
        queryKey: ["studio-appointments", household.id],
      });
    } catch (error) {
      console.error(error);
      alert("Não foi possível criar o agendamento.");
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
                Agenda
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Seus próximos atendimentos
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
              Novo agendamento
            </h2>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <select
                  value={clientId}
                  onChange={(event) =>
                    setClientId(event.target.value)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-4 pr-10 text-sm outline-none focus:border-income/40"
                >
                  <option value="">Selecione a cliente</option>

                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              <div className="relative">
                <select
                  value={serviceId}
                  onChange={(event) =>
                    handleServiceChange(event.target.value)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-4 pr-10 text-sm outline-none focus:border-income/40"
                >
                  <option value="">Selecione o serviço</option>

                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={total}
                  onChange={(event) =>
                    setTotal(event.target.value)
                  }
                  placeholder="Valor total"
                  className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-income/40"
                />

                <input
                  type="text"
                  inputMode="decimal"
                  value={deposit}
                  onChange={(event) =>
                    setDeposit(event.target.value)
                  }
                  placeholder="Sinal"
                  className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-income/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={date}
                  onChange={(event) =>
                    setDate(event.target.value)
                  }
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-income/40"
                />

                <input
                  type="time"
                  value={time}
                  onChange={(event) =>
                    setTime(event.target.value)
                  }
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-income/40"
                />
              </div>

              <button
                type="button"
                disabled={
                  saving ||
                  !clientId ||
                  !serviceName ||
                  !date
                }
                onClick={createAppointment}
                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Agendar atendimento"}
              </button>
            </div>
          </section>
        )}

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold">
              Próximos atendimentos
            </h2>
          </div>

          {isLoading ? (
            <div className="surface px-4 py-6 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : appointments.length === 0 ? (
            <div className="surface px-5 py-8 text-center">
              <CalendarDays className="mx-auto size-6 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">
                Agenda vazia
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre seu próximo atendimento.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {appointments.map((appointment) => {
                const client = Array.isArray(
                  appointment.studio_clients
                )
                  ? appointment.studio_clients[0]
                  : appointment.studio_clients;

                const remaining =
                  Number(appointment.total_amount) -
                  Number(appointment.received_amount);

                return (
                  <div
                    key={appointment.id}
                    className="surface p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
                        <UserRound
                          className="size-5"
                          strokeWidth={1.6}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {client?.name ?? "Cliente"}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {appointment.service_name}
                        </p>
                      </div>

                      <p className="text-sm font-semibold">
                        R${" "}
                        {Number(
                          appointment.total_amount
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays
                            className="size-3.5"
                            strokeWidth={1.6}
                          />
                          {appointment.scheduled_date}
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
                      </div>

                      <span className="text-xs font-medium text-warning">
                        A receber: R${" "}
                        {remaining.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
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
