import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Cake,
  CalendarDays,
  ChevronRight,
  LogOut,
  MoreVertical,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { useHousehold } from "@/hooks/use-household";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Studio Lary Andrade" },
      {
        name: "description",
        content: "Gestão financeira e agenda do Studio Lary Andrade.",
      },
    ],
  }),
  component: InicioPage,
});

type Appointment = {
  id: string;
  service_name: string;
  total_amount: number;
  received_amount: number;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  studio_clients:
    | { name: string }
    | { name: string }[]
    | null;
};

type BirthdayClient = {
  id: string;
  name: string;
  birth_date: string;
};

function InicioPage() {
  const { data: household } = useHousehold();

  const today = new Date();

  const monthStart = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const monthEndDate = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  );

  const monthEnd = `${monthEndDate.getFullYear()}-${String(
    monthEndDate.getMonth() + 1
  ).padStart(2, "0")}-${String(
    monthEndDate.getDate()
  ).padStart(2, "0")}`;

  const monthLabel = today.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const { data: transactions = [], isLoading: loadingFinance } =
    useQuery({
      queryKey: [
        "studio-dashboard-transactions",
        household?.id,
        monthStart,
        monthEnd,
      ],
      enabled: Boolean(household?.id),
      queryFn: async () => {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, description, amount, type, date, status")
          .eq("household_id", household!.id)
          .gte("date", monthStart)
          .lte("date", monthEnd)
          .order("date", { ascending: false });

        if (error) throw error;

        return data ?? [];
      },
    });

  const {
    data: appointments = [],
    isLoading: loadingAppointments,
  } = useQuery({
    queryKey: [
      "studio-dashboard-appointments",
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
          received_amount,
          scheduled_date,
          scheduled_time,
          status,
          studio_clients(name)
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

  const { data: services = [] } = useQuery({
    queryKey: ["studio-dashboard-services", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_services")
        .select("id")
        .eq("household_id", household!.id)
        .eq("active", true);

      if (error) throw error;

      return data ?? [];
    },
  });

  const { data: birthdayClients = [] } = useQuery({
    queryKey: ["studio-birthdays", household?.id],
    enabled: Boolean(household?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_clients")
        .select("id, name, birth_date")
        .eq("household_id", household?.id ?? "")
        .not("birth_date", "is", null);

      if (error) throw error;
      return (data ?? []) as BirthdayClient[];
    },
  });

  const birthdays = birthdayClients
    .flatMap((client) => {
      const [, month, day] = client.birth_date.split("-").map(Number);
      if (!month || !day) return [];
      let nextDate = new Date(today.getFullYear(), month - 1, day);
      const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (nextDate < startToday) nextDate = new Date(today.getFullYear() + 1, month - 1, day);
      const daysUntil = Math.round((nextDate.getTime() - startToday.getTime()) / 86_400_000);
      return [{ ...client, nextDate, daysUntil }];
    })
    .filter((client) => client.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const birthdaysToday = birthdays.filter((client) => client.daysUntil === 0);
  const upcomingBirthdays = birthdays.filter((client) => client.daysUntil > 0);

  const received = transactions
    .filter(
      (item) =>
        item.type === "income" &&
        item.status !== "pending"
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expenses = transactions
    .filter(
      (item) =>
        item.type === "expense" &&
        item.status !== "pending"
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const pendingTransactions = transactions
    .filter(
      (item) =>
        item.type === "income" &&
        item.status === "pending"
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const appointmentPending = appointments.reduce(
    (sum, appointment) =>
      sum +
      Math.max(
        Number(appointment.total_amount) -
          Number(appointment.received_amount),
        0
      ),
    0
  );

  const totalPending = pendingTransactions + appointmentPending;
  const balance = received - expenses;

  const todayAppointments = appointments.filter(
    (appointment) =>
      appointment.scheduled_date ===
      today.toISOString().slice(0, 10)
  );

  const upcomingAppointments = appointments
    .filter(
      (appointment) =>
        appointment.scheduled_date >=
        today.toISOString().slice(0, 10)
    )
    .slice(0, 3);

  function money(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    });
  }

  function getClientName(appointment: Appointment) {
    if (Array.isArray(appointment.studio_clients)) {
      return appointment.studio_clients[0]?.name ?? "Cliente";
    }

    return appointment.studio_clients?.name ?? "Cliente";
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AppShell
      title="Olá, Lary 💕"
      subtitle={`Resumo de ${monthLabel}`}
      action={
        <button
          type="button"
          onClick={signOut}
          className="flex size-10 items-center justify-center rounded-full border border-black/[0.06] bg-white text-[#817b7d]"
          aria-label="Sair"
        >
          <LogOut className="size-4" strokeWidth={1.7} />
        </button>
      }
    >
      {birthdaysToday.map((client) => (
        <Link
          key={client.id}
          to="/clientes"
          hash={`cliente-${client.id}`}
          className="mb-3 flex items-center gap-3 rounded-2xl bg-[#f3e5e8] p-4 text-[#9d6875]"
        >
          <Cake className="size-5 shrink-0" strokeWidth={1.7} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#211f20]">Hoje é aniversário de {client.name}! 🎂</p>
            <p className="mt-1 text-xs text-[#8d6871]">Toque para abrir o cadastro da cliente</p>
          </div>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      ))}

      {upcomingBirthdays.length > 0 && (
        <section className="mb-5 rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#9d6875]">
            <Cake className="size-4" strokeWidth={1.7} />
            <h2 className="text-sm font-semibold text-[#211f20]">Próximos aniversários</h2>
          </div>
          <div className="mt-3 space-y-2">
            {upcomingBirthdays.slice(0, 3).map((client) => (
              <Link
                key={client.id}
                to="/clientes"
                hash={`cliente-${client.id}`}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="truncate font-medium text-[#625d5f]">{client.name}</span>
                <span className="shrink-0 text-[#817b7d]">
                  {client.nextDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* RESUMO PRINCIPAL */}
      <section className="rounded-[26px] bg-[#b7838e] p-5 text-white shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/70">
          Saldo do mês
        </p>

        <p className="mt-2 text-3xl font-semibold tracking-tight">
          {loadingFinance ? "—" : `R$ ${money(balance)}`}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
          <div>
            <p className="text-[11px] text-white/70">
              Recebido
            </p>
            <p className="mt-1 text-base font-semibold">
              R$ {money(received)}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-white/70">
              Gastos
            </p>
            <p className="mt-1 text-base font-semibold">
              R$ {money(expenses)}
            </p>
          </div>
        </div>
      </section>

      {/* CARDS SECUNDÁRIOS */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Link
          to="/movimentacoes"
          className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#9d6875]">
            <WalletCards
              className="size-4"
              strokeWidth={1.7}
            />
            <span className="text-xs font-medium">
              A receber
            </span>
          </div>

          <p className="mt-3 text-xl font-semibold text-[#211f20]">
            R$ {money(totalPending)}
          </p>

          <p className="mt-1 text-[10px] text-[#817b7d]">
            Valores ainda não recebidos
          </p>
        </Link>

        <Link
          to="/agenda"
          className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#9d6875]">
            <CalendarDays
              className="size-4"
              strokeWidth={1.7}
            />
            <span className="text-xs font-medium">
              Hoje
            </span>
          </div>

          <p className="mt-3 text-xl font-semibold text-[#211f20]">
            {todayAppointments.length}
          </p>

          <p className="mt-1 text-[10px] text-[#817b7d]">
            {todayAppointments.length === 1
              ? "atendimento hoje"
              : "atendimentos hoje"}
          </p>
        </Link>
      </section>

      {/* AÇÕES RÁPIDAS */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#211f20]">
            Acesso rápido
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/agenda"
            className="flex items-center gap-3 rounded-2xl bg-[#f3e5e8] p-4 text-[#9d6875]"
          >
            <CalendarDays
              className="size-5"
              strokeWidth={1.6}
            />

            <div>
              <p className="text-sm font-semibold">
                Agenda
              </p>
              <p className="mt-0.5 text-[10px] text-[#8d6871]">
                Ver atendimentos
              </p>
            </div>
          </Link>

          <Link
            to="/servicos"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 text-[#9d6875] shadow-sm ring-1 ring-black/[0.04]"
          >
            <Sparkles
              className="size-5"
              strokeWidth={1.6}
            />

            <div>
              <p className="text-sm font-semibold text-[#211f20]">
                Serviços
              </p>
              <p className="mt-0.5 text-[10px] text-[#817b7d]">
                {services.length} cadastrados
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* PRÓXIMOS ATENDIMENTOS */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#211f20]">
              Próximos atendimentos
            </h2>

            <p className="mt-1 text-xs text-[#817b7d]">
              Sua agenda mais próxima
            </p>
          </div>

          <Link
            to="/agenda"
            className="flex items-center gap-1 text-xs font-medium text-[#9d6875]"
          >
            Ver agenda
            <ChevronRight className="size-3" />
          </Link>
        </div>

        {loadingAppointments ? (
          <div className="rounded-2xl bg-white px-4 py-7 text-center text-sm text-[#817b7d]">
            Carregando...
          </div>
        ) : upcomingAppointments.length === 0 ? (
          <EmptyState text="Nenhum atendimento próximo." />
        ) : (
          <div className="space-y-2">
            {upcomingAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[#f3e5e8] text-[#9d6875]">
                    <span className="text-[9px] uppercase">
                      {new Date(
                        `${appointment.scheduled_date}T12:00:00`
                      ).toLocaleDateString("pt-BR", {
                        weekday: "short",
                      })}
                    </span>

                    <span className="text-sm font-semibold leading-none">
                      {new Date(
                        `${appointment.scheduled_date}T12:00:00`
                      ).getDate()}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#211f20]">
                      {getClientName(appointment)}
                    </p>

                    <p className="mt-1 truncate text-xs text-[#817b7d]">
                      {appointment.service_name}
                      {appointment.scheduled_time
                        ? ` · ${appointment.scheduled_time.slice(
                            0,
                            5
                          )}`
                        : ""}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#211f20]">
                      R${" "}
                      {money(
                        Number(appointment.total_amount)
                      )}
                    </p>

                    <p className="mt-1 text-[10px] text-[#9d6875]">
                      A receber R${" "}
                      {money(
                        Math.max(
                          Number(appointment.total_amount) -
                            Number(
                              appointment.received_amount
                            ),
                          0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RODAPÉ DISCRETO */}
      <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-[#aaa5a6]">
        <MoreVertical className="size-3" />
        Studio Lary Andrade
      </div>
    </AppShell>
  );
}
