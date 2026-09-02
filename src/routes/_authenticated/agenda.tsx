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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import {
  AppShell,
} from "@/components/AppShell";

export const Route = createFileRoute(
  "/_authenticated/agenda"
)({
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
    | {
        name: string;
        phone: string | null;
      }
    | {
        name: string;
        phone: string | null;
      }[]
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

type ServiceMetadataMap =
  Record<string, ServiceMetadata>;

type SelectedService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type AppointmentServicesMap = Record<
  string,
  SelectedService[]
>;

type CalendarBlock = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  duration_minutes: number;
  all_day: boolean;
};

type CalendarBlocksMap = Record<
  string,
  CalendarBlock[]
>;

const METADATA_KEY_PREFIX =
  "studio-services-metadata-";

const APPOINTMENT_SERVICES_KEY_PREFIX =
  "studio-appointment-services-";

const CALENDAR_BLOCKS_KEY_PREFIX =
  "studio-calendar-blocks-";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const SLOT_MINUTES = 30;

function getMetadataKey(
  householdId: string
) {
  return `${METADATA_KEY_PREFIX}${householdId}`;
}

function getAppointmentServicesKey(
  householdId: string
) {
  return `${APPOINTMENT_SERVICES_KEY_PREFIX}${householdId}`;
}

function getCalendarBlocksKey(
  householdId: string
) {
  return `${CALENDAR_BLOCKS_KEY_PREFIX}${householdId}`;
}

function loadServiceMetadata(
  householdId?: string
): ServiceMetadataMap {
  if (
    !householdId ||
    typeof window === "undefined"
  ) {
    return {};
  }

  try {
    const saved =
      localStorage.getItem(
        getMetadataKey(
          householdId
        )
      );

    if (!saved) return {};

    return JSON.parse(
      saved
    ) as ServiceMetadataMap;
  } catch {
    return {};
  }
}

function loadAppointmentServices(
  householdId?: string
): AppointmentServicesMap {
  if (
    !householdId ||
    typeof window === "undefined"
  ) {
    return {};
  }

  try {
    const saved =
      localStorage.getItem(
        getAppointmentServicesKey(
          householdId
        )
      );

    if (!saved) return {};

    return JSON.parse(
      saved
    ) as AppointmentServicesMap;
  } catch {
    return {};
  }
}

function saveAppointmentServices(
  householdId: string,
  data: AppointmentServicesMap
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  localStorage.setItem(
    getAppointmentServicesKey(
      householdId
    ),
    JSON.stringify(data)
  );
}

function loadCalendarBlocks(
  householdId?: string
): CalendarBlocksMap {
  if (
    !householdId ||
    typeof window === "undefined"
  ) {
    return {};
  }

  try {
    const saved =
      localStorage.getItem(
        getCalendarBlocksKey(
          householdId
        )
      );

    if (!saved) return {};

    return JSON.parse(
      saved
    ) as CalendarBlocksMap;
  } catch {
    return {};
  }
}

function saveCalendarBlocks(
  householdId: string,
  data: CalendarBlocksMap
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  localStorage.setItem(
    getCalendarBlocksKey(
      householdId
    ),
    JSON.stringify(data)
  );
}

function formatDuration(
  minutes: number
) {
  if (!minutes) {
    return "Duração não definida";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const remaining =
    minutes % 60;

  if (!remaining) {
    return hours === 1
      ? "1 hora"
      : `${hours} horas`;
  }

  return `${hours}h ${remaining}min`;
}

function timeToMinutes(
  time: string | null
) {
  if (!time) return null;

  const [
    hours,
    minutes,
  ] = time
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return (
    hours * 60 +
    minutes
  );
}

function minutesToTime(
  minutes: number
) {
  const hours =
    Math.floor(
      minutes / 60
    );

  const mins =
    minutes % 60;

  return `${String(
    hours
  ).padStart(
    2,
    "0"
  )}:${String(
    mins
  ).padStart(
    2,
    "0"
  )}`;
}

function dateToKey(
  date: Date
) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    date.getDate()
  ).padStart(
    2,
    "0"
  )}`;
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
  const {
    data: household,
  } = useHousehold();

  const queryClient =
    useQueryClient();

  const today =
    new Date();

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  );

  const [
    viewMode,
    setViewMode,
  ] = useState<
    "dia" | "mes"
  >("dia");

  const [
    selectedDay,
    setSelectedDay,
  ] = useState(
    dateToKey(today)
  );

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState<
    Appointment | null
  >(null);

  const [
    clientId,
    setClientId,
  ] = useState("");

  const [
    selectedServices,
    setSelectedServices,
  ] = useState<
    SelectedService[]
  >([]);

  const [
    serviceToAdd,
    setServiceToAdd,
  ] = useState("");

  const [
    deposit,
    setDeposit,
  ] = useState("");

  const [
    date,
    setDate,
  ] = useState(
    dateToKey(today)
  );

  const [
    time,
    setTime,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    calendarBlocks,
    setCalendarBlocks,
  ] = useState<CalendarBlocksMap>(
    {}
  );

  const [
    showBlockForm,
    setShowBlockForm,
  ] = useState(false);

  const [
    blockTitle,
    setBlockTitle,
  ] = useState("");

  const [
    blockDate,
    setBlockDate,
  ] = useState(
    dateToKey(today)
  );

  const [
    blockTime,
    setBlockTime,
  ] = useState("");

  const [
    blockDuration,
    setBlockDuration,
  ] = useState(60);

  const [
    blockAllDay,
    setBlockAllDay,
  ] = useState(false);

  const [
    savingBlock,
    setSavingBlock,
  ] = useState(false);

  const serviceMetadata =
    useMemo(
      () =>
        loadServiceMetadata(
          household?.id
        ),
      [household?.id]
    );

  const appointmentServices =
    useMemo(
      () =>
        loadAppointmentServices(
          household?.id
        ),
      [household?.id]
    );

  useEffect(() => {
    if (!household?.id) {
      return;
    }

    setCalendarBlocks(
      loadCalendarBlocks(
        household.id
      )
    );
  }, [
    household?.id,
  ]);

  const monthStart =
    useMemo(
      () =>
        `${selectedMonth.getFullYear()}-${String(
          selectedMonth.getMonth() + 1
        ).padStart(
          2,
          "0"
        )}-01`,
      [selectedMonth]
    );

  const monthEnd =
    useMemo(() => {
      const end =
        new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth() +
            1,
          0
        );

      return `${end.getFullYear()}-${String(
        end.getMonth() + 1
      ).padStart(
        2,
        "0"
      )}-${String(
        end.getDate()
      ).padStart(
        2,
        "0"
      )}`;
    }, [
      selectedMonth,
    ]);

  const monthLabel =
    selectedMonth.toLocaleDateString(
      "pt-BR",
      {
        month: "long",
        year: "numeric",
      }
    );

  const selectedDayBlocks =
    useMemo(
      () =>
        calendarBlocks[
          selectedDay
        ] ?? [],
      [
        calendarBlocks,
        selectedDay,
      ]
    );

  const monthBlocks =
    useMemo(() => {
      return Object.values(
        calendarBlocks
      )
        .flat()
        .filter(
          (block) =>
            block.date >=
              monthStart &&
            block.date <=
              monthEnd
        );
    }, [
      calendarBlocks,
      monthStart,
      monthEnd,
    ]);

  const {
    data: clients = [],
  } = useQuery({
    queryKey: [
      "studio-clients",
      household?.id,
    ],
    enabled:
      Boolean(
        household?.id
      ),
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from(
          "studio_clients"
        )
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

  const {
    data: services = [],
  } = useQuery({
    queryKey: [
      "studio-services",
      household?.id,
    ],
    enabled:
      Boolean(
        household?.id
      ),
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from(
          "studio_services"
        )
        .select(
          "id, name, default_price"
        )
        .eq(
          "household_id",
          household!.id
        )
        .eq(
          "active",
          true
        )
        .order("name");

      if (error) throw error;

      return (
        data ?? []
      ) as Service[];
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
    enabled:
      Boolean(
        household?.id
      ),
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from(
          "studio_appointments"
        )
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

      return (
        data ?? []
      ) as Appointment[];
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
          .sort(
            (a, b) => {
              const aTime =
                timeToMinutes(
                  a.scheduled_time
                ) ?? 0;

              const bTime =
                timeToMinutes(
                  b.scheduled_time
                ) ?? 0;

              return (
                aTime -
                bTime
              );
            }
          ),
      [
        appointments,
        selectedDay,
      ]
    );

  function parseMoney(
    value: string
  ) {
    return (
      Number(
        value
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          )
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

  function getServiceDuration(
    id: string
  ) {
    return (
      serviceMetadata[id]
        ?.duration_minutes ||
      60
    );
  }

  function getAppointmentServiceList(
    appointment: Appointment
  ) {
    const saved =
      appointmentServices[
        appointment.id
      ];

    if (
      saved &&
      saved.length > 0
    ) {
      return saved;
    }

    if (
      appointment.service_id
    ) {
      const service =
        services.find(
          (item) =>
            item.id ===
            appointment.service_id
        );

      if (service) {
        return [
          {
            id: service.id,
            name:
              service.name,
            price:
              Number(
                appointment.total_amount
              ),
            duration:
              getServiceDuration(
                service.id
              ),
          },
        ];
      }
    }

    return [
      {
        id:
          appointment.service_id ??
          "legacy",
        name:
          appointment.service_name,
        price:
          Number(
            appointment.total_amount
          ),
        duration: 60,
      },
    ];
  }

  function getDuration(
    appointment: Appointment
  ) {
    return getAppointmentServiceList(
      appointment
    ).reduce(
      (
        total,
        service
      ) =>
        total +
        service.duration,
      0
    );
  }

  function getSelectedTotal() {
    return selectedServices.reduce(
      (
        total,
        service
      ) =>
        total +
        service.price,
      0
    );
  }

  function getSelectedDuration() {
    return selectedServices.reduce(
      (
        total,
        service
      ) =>
        total +
        service.duration,
      0
    );
  }

  function getBlockDuration(
    block: CalendarBlock
  ) {
    if (block.all_day) {
      return (
        DAY_END_HOUR -
        DAY_START_HOUR
      ) * 60;
    }

    return block.duration_minutes;
  }

  function previousMonth() {
    const next =
      new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() -
          1,
        1
      );

    setSelectedMonth(
      next
    );

    setSelectedDay(
      dateToKey(next)
    );
  }

  function nextMonth() {
    const next =
      new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() +
          1,
        1
      );

    setSelectedMonth(
      next
    );

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
    setSelectedServices(
      []
    );
    setServiceToAdd("");
    setDeposit("");
    setDate(
      appointmentDate
    );
    setTime(
      timeValue ?? ""
    );
    setShowForm(true);
  }

  function openEdit(
    appointment: Appointment
  ) {
    const savedServices =
      getAppointmentServiceList(
        appointment
      );

    setEditing(
      appointment
    );

    setClientId(
      appointment.client_id ??
        ""
    );

    setSelectedServices(
      savedServices
    );

    setServiceToAdd("");

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
        ?.slice(0, 5) ??
        ""
    );

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditing(null);
    setSelectedServices(
      []
    );
    setServiceToAdd("");
  }

  function addService() {
    if (!serviceToAdd) {
      return;
    }

    const service =
      services.find(
        (item) =>
          item.id ===
          serviceToAdd
      );

    if (!service) {
      return;
    }

    const alreadyAdded =
      selectedServices.some(
        (item) =>
          item.id ===
          service.id
      );

    if (alreadyAdded) {
      alert(
        "Este serviço já foi adicionado."
      );
      return;
    }

    setSelectedServices(
      [
        ...selectedServices,
        {
          id: service.id,
          name:
            service.name,
          price:
            Number(
              service.default_price
            ),
          duration:
            getServiceDuration(
              service.id
            ),
        },
      ]
    );

    setServiceToAdd("");
  }

  function removeService(
    serviceId: string
  ) {
    setSelectedServices(
      (current) =>
        current.filter(
          (service) =>
            service.id !==
            serviceId
        )
    );
  }

  function hasBlockConflict(
    startTime: string,
    appointmentDate: string,
    appointmentDuration: number
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

    return (
      calendarBlocks[
        appointmentDate
      ] ?? []
    ).some(
      (block) => {
        const blockStart =
          block.all_day
            ? DAY_START_HOUR *
              60
            : timeToMinutes(
                block.start_time
              );

        if (
          blockStart ===
          null
        ) {
          return false;
        }

        const blockEnd =
          blockStart +
          getBlockDuration(
            block
          );

        return (
          newStart <
            blockEnd &&
          newEnd >
            blockStart
        );
      }
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
      newStart ===
      null
    ) {
      return false;
    }

    const newEnd =
      newStart +
      appointmentDuration;

    const appointmentConflict =
      appointments.some(
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

    if (
      appointmentConflict
    ) {
      return true;
    }

    return hasBlockConflict(
      startTime,
      appointmentDate,
      appointmentDuration
    );
  }

  function openBlockForm(
    dateValue?: string,
    timeValue?: string
  ) {
    setBlockTitle("");

    setBlockDate(
      dateValue ??
        selectedDay ??
        dateToKey(today)
    );

    setBlockTime(
      timeValue ?? ""
    );

    setBlockDuration(
      60
    );

    setBlockAllDay(
      false
    );

    setShowBlockForm(
      true
    );
  }

  function closeBlockForm() {
    if (savingBlock) return;

    setShowBlockForm(
      false
    );
  }

  async function saveCalendarBlock() {
    if (
      !household?.id ||
      !blockDate
    ) {
      return;
    }

    if (
      !blockAllDay &&
      !blockTime
    ) {
      alert(
        "Informe o horário do compromisso."
      );
      return;
    }

    if (
      !blockAllDay &&
      blockDuration <
        15
    ) {
      alert(
        "A duração mínima é de 15 minutos."
      );
      return;
    }

    if (
      !blockAllDay
    ) {
      const blockStart =
        timeToMinutes(
          blockTime
        );

      if (
        blockStart ===
        null
      ) {
        alert(
          "Informe um horário válido."
        );
        return;
      }

      const blockEnd =
        blockStart +
        blockDuration;

      if (
        blockEnd >
        DAY_END_HOUR *
          60
      ) {
        alert(
          `O bloqueio precisa terminar até ${DAY_END_HOUR}:00.`
        );
        return;
      }

      if (
        hasConflict(
          blockTime,
          blockDate,
          blockDuration
        )
      ) {
        alert(
          "Este horário já está ocupado. Escolha outro horário."
        );
        return;
      }
    }

    if (
      blockAllDay
    ) {
      const existingAppointments =
        appointments.some(
          (appointment) =>
            appointment.scheduled_date ===
            blockDate
        );

      const existingBlocks =
        (
          calendarBlocks[
            blockDate
          ] ?? []
        ).length > 0;

      if (
        existingAppointments ||
        existingBlocks
      ) {
        alert(
          "Este dia já possui horários ocupados. Remova os agendamentos ou bloqueios antes de bloquear o dia inteiro."
        );
        return;
      }
    }

    setSavingBlock(
      true
    );

    try {
      const newBlock: CalendarBlock =
        {
          id:
            crypto.randomUUID(),
          title:
            blockTitle.trim() ||
            "Compromisso pessoal",
          date: blockDate,
          start_time:
            blockAllDay
              ? null
              : blockTime,
          duration_minutes:
            blockAllDay
              ? (DAY_END_HOUR -
                  DAY_START_HOUR) *
                60
              : blockDuration,
          all_day:
            blockAllDay,
        };

      const nextBlocks: CalendarBlocksMap =
        {
          ...calendarBlocks,
          [blockDate]: [
            ...(calendarBlocks[
              blockDate
            ] ?? []),
            newBlock,
          ],
        };

      setCalendarBlocks(
        nextBlocks
      );

      saveCalendarBlocks(
        household.id,
        nextBlocks
      );

      setSelectedDay(
        blockDate
      );

      setSelectedMonth(
        new Date(
          `${blockDate}T12:00:00`
        )
      );

      setShowBlockForm(
        false
      );
    } finally {
      setSavingBlock(
        false
      );
    }
  }

  function deleteCalendarBlock(
    block: CalendarBlock
  ) {
    if (
      !household?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remover "${block.title}" da agenda?`
      );

    if (!confirmed) {
      return;
    }

    const nextBlocks: CalendarBlocksMap =
      {
        ...calendarBlocks,
        [block.date]: (
          calendarBlocks[
            block.date
          ] ?? []
        ).filter(
          (item) =>
            item.id !==
            block.id
        ),
      };

    if (
      nextBlocks[
        block.date
      ]?.length === 0
    ) {
      delete nextBlocks[
        block.date
      ];
    }

    setCalendarBlocks(
      nextBlocks
    );

    saveCalendarBlocks(
      household.id,
      nextBlocks
    );
  }

  async function saveAppointment() {
    if (
      !household?.id ||
      !clientId ||
      !date ||
      !time
    ) {
      alert(
        "Preencha cliente, data e horário."
      );
      return;
    }

    if (
      selectedServices.length ===
      0
    ) {
      alert(
        "Adicione pelo menos um serviço."
      );
      return;
    }

    const totalAmount =
      getSelectedTotal();

    const totalDuration =
      getSelectedDuration();

    if (
      !totalDuration
    ) {
      alert(
        "A duração dos serviços precisa ser válida."
      );
      return;
    }

    if (
      hasConflict(
        time,
        date,
        totalDuration,
        editing?.id
      )
    ) {
      alert(
        "Este horário já está ocupado por outro atendimento ou compromisso. Escolha outro horário."
      );
      return;
    }

    const start =
      timeToMinutes(
        time
      );

    if (
      start !== null &&
      start +
        totalDuration >
        DAY_END_HOUR *
          60
    ) {
      alert(
        `O atendimento precisa terminar até ${DAY_END_HOUR}:00.`
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Usuário não autenticado."
        );
      }

      const depositAmount =
        Math.min(
          parseMoney(
            deposit
          ),
          totalAmount
        );

      const serviceName =
        selectedServices
          .map(
            (service) =>
              service.name
          )
          .join(" + ");

      let appointmentId =
        editing?.id;

      if (editing) {
        const {
          error,
        } = await supabase
          .from(
            "studio_appointments"
          )
          .update({
            client_id:
              clientId,
            service_id:
              selectedServices[0]
                ?.id ??
              null,
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

        if (error) {
          throw error;
        }
      } else {
        const {
          data,
          error,
        } = await supabase
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
              selectedServices[0]
                ?.id ??
              null,
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
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        appointmentId =
          data.id;
      }

      if (
        appointmentId
      ) {
        const current =
          loadAppointmentServices(
            household.id
          );

        current[
          appointmentId
        ] =
          selectedServices;

        saveAppointmentServices(
          household.id,
          current
        );
      }

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "studio-appointments",
          ],
        }
      );

      setSelectedDay(
        date
      );

      setSelectedMonth(
        new Date(
          `${date}T12:00:00`
        )
      );

      setShowForm(
        false
      );

      setEditing(null);
      setSelectedServices(
        []
      );
      setServiceToAdd("");
    } catch (error) {
      console.error(
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o agendamento."
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveAppointment(
    appointment: Appointment,
    newTime: string
  ) {
    if (!household?.id) {
      return;
    }

    const duration =
      getDuration(
        appointment
      );

    if (
      hasConflict(
        newTime,
        appointment.scheduled_date,
        duration,
        appointment.id
      )
    ) {
      alert(
        "Este horário já está ocupado por outro atendimento ou compromisso."
      );
      return;
    }

    const start =
      timeToMinutes(
        newTime
      );

    if (
      start === null
    ) {
      return;
    }

    if (
      start +
        duration >
        DAY_END_HOUR *
          60
    ) {
      alert(
        `O atendimento precisa terminar até ${DAY_END_HOUR}:00.`
      );
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from(
          "studio_appointments"
        )
        .update({
          scheduled_time:
            newTime,
        })
        .eq(
          "id",
          appointment.id
        )
        .eq(
          "household_id",
          household.id
        );

      if (error) {
        throw error;
      }

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "studio-appointments",
          ],
        }
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível mover o atendimento."
      );
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
      const {
        error,
      } = await supabase
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

      if (error) {
        throw error;
      }

      const current =
        loadAppointmentServices(
          household.id
        );

      delete current[
        appointment.id
      ];

      saveAppointmentServices(
        household.id,
        current
      );

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "studio-appointments",
          ],
        }
      );
    } catch (error) {
      console.error(
        error
      );

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
      getClient(
        appointment
      );

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
        ) ??
        "a confirmar"
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
    if (
      !household?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Finalizar o atendimento de ${
          getClient(
            appointment
          )?.name ??
          "cliente"
        } e marcar como pago?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
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

      if (error) {
        throw error;
      }

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
      console.error(
        error
      );

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
              {monthBlocks.length >
                0 &&
                ` • ${monthBlocks.length} bloqueio${
                  monthBlocks.length ===
                  1
                    ? ""
                    : "s"
                }`}
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
            blocks={
              monthBlocks
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
            blocks={
              selectedDayBlocks
            }
            getDuration={
              getDuration
            }
            getAppointmentServices={
              getAppointmentServiceList
            }
            onSelectTime={(
              timeValue
            ) =>
              openNew(
                selectedDay,
                timeValue
              )
            }
            onBlock={(
              timeValue
            ) =>
              openBlockForm(
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
            onDeleteBlock={
              deleteCalendarBlock
            }
            onWhatsApp={
              openWhatsApp
            }
            onFinalize={
              finalizeAppointment
            }
            onMove={
              moveAppointment
            }
          />
        )}
      </section>

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

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Serviços
                </label>

                {selectedServices.length >
                  0 && (
                  <div className="mb-2 space-y-2">
                    {selectedServices.map(
                      (
                        service
                      ) => (
                        <div
                          key={
                            service.id
                          }
                          className="flex items-center gap-3 rounded-xl border border-[#b7838e]/15 bg-[#f3e5e8] px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[#211f20]">
                              {
                                service.name
                              }
                            </p>

                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[10px] text-[#817b7d]">
                                {formatDuration(
                                  service.duration
                                )}
                              </span>

                              <span className="text-[10px] text-[#9d6875]">
                                R${" "}
                                {formatMoney(
                                  service.price
                                )}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeService(
                                service.id
                              )
                            }
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#9d6875]"
                            aria-label={`Remover ${service.name}`}
                          >
                            <X
                              className="size-3.5"
                              strokeWidth={
                                1.8
                              }
                            />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={
                      serviceToAdd
                    }
                    onChange={(
                      event
                    ) =>
                      setServiceToAdd(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-11 min-w-0 flex-1 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                  >
                    <option value="">
                      {selectedServices.length >
                      0
                        ? "Adicionar outro serviço"
                        : "Selecione um serviço"}
                    </option>

                    {services
                      .filter(
                        (
                          service
                        ) =>
                          !selectedServices.some(
                            (
                              selected
                            ) =>
                              selected.id ===
                              service.id
                          )
                      )
                      .map(
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

                  <button
                    type="button"
                    onClick={
                      addService
                    }
                    disabled={
                      !serviceToAdd
                    }
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#b7838e] px-4 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    <Plus
                      className="size-4"
                      strokeWidth={
                        1.8
                      }
                    />
                    Adicionar
                  </button>
                </div>

                {selectedServices.length >
                  1 && (
                  <p className="mt-2 text-[10px] text-[#817b7d]">
                    Você pode combinar vários serviços no mesmo atendimento.
                  </p>
                )}
              </div>

              {selectedServices.length >
                0 && (
                <div className="rounded-2xl bg-[#f3e5e8] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#817b7d]">
                      Serviços
                    </span>

                    <strong className="text-xs text-[#9d6875]">
                      {
                        selectedServices.length
                      }
                    </strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[#817b7d]">
                      Tempo total
                    </span>

                    <strong className="text-xs text-[#9d6875]">
                      {formatDuration(
                        getSelectedDuration()
                      )}
                    </strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-[#b7838e]/20 pt-2">
                    <span className="text-xs font-medium text-[#625d5f]">
                      Valor total
                    </span>

                    <strong className="text-sm text-[#211f20]">
                      R${" "}
                      {formatMoney(
                        getSelectedTotal()
                      )}
                    </strong>
                  </div>
                </div>
              )}

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

              {selectedServices.length >
                0 && (
                <div className="rounded-2xl bg-[#f3e5e8] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#817b7d]">
                      Total
                    </span>

                    <strong className="text-sm text-[#211f20]">
                      R${" "}
                      {formatMoney(
                        getSelectedTotal()
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
                          getSelectedTotal() -
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
                        getSelectedDuration()
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
                saving ||
                selectedServices.length ===
                  0
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

      {showBlockForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5">
          <div className="w-full max-w-md rounded-t-3xl bg-[#faf9f8] p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#aaa5a6]">
                  Agenda
                </p>

                <h2 className="mt-1 text-xl font-semibold text-[#211f20]">
                  Bloquear horário
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-[#817b7d]">
                  Reserve esse período para um compromisso pessoal.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeBlockForm
                }
                className="flex size-9 items-center justify-center rounded-full bg-white text-[#817b7d]"
                aria-label="Fechar"
              >
                <X
                  className="size-4"
                  strokeWidth={
                    1.7
                  }
                />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-4 overflow-y-auto pb-1">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Motivo
                </label>

                <input
                  value={
                    blockTitle
                  }
                  onChange={(
                    event
                  ) =>
                    setBlockTitle(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Ex.: Médico, compromisso pessoal, folga..."
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                  Data
                </label>

                <input
                  type="date"
                  value={
                    blockDate
                  }
                  onChange={(
                    event
                  ) =>
                    setBlockDate(
                      event
                        .target
                        .value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#211f20] outline-none focus:border-[#b7838e]"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-3">
                <input
                  type="checkbox"
                  checked={
                    blockAllDay
                  }
                  onChange={(
                    event
                  ) =>
                    setBlockAllDay(
                      event
                        .target
                        .checked
                    )
                  }
                  className="size-4 accent-[#b7838e]"
                />

                <div>
                  <p className="text-xs font-semibold text-[#211f20]">
                    Bloquear o dia inteiro
                  </p>

                  <p className="mt-0.5 text-[10px] leading-relaxed text-[#aaa5a6]">
                    Nenhum atendimento poderá ser agendado neste dia.
                  </p>
                </div>
              </label>

              {!blockAllDay && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#625d5f]">
                      Horário inicial
                    </label>

                    <input
                      type="time"
                      value={
                        blockTime
                      }
                      onChange={(
                        event
                      ) =>
                        setBlockTime(
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
                      Duração
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        30,
                        60,
                        90,
                        120,
                        180,
                        240,
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
                              setBlockDuration(
                                value
                              )
                            }
                            className={`rounded-xl border py-2.5 text-xs font-medium ${
                              blockDuration ===
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

                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] text-[#aaa5a6]">
                        Personalizado:
                      </span>

                      <input
                        type="number"
                        min="15"
                        step="15"
                        value={
                          blockDuration
                        }
                        onChange={(
                          event
                        ) =>
                          setBlockDuration(
                            Number(
                              event
                                .target
                                .value
                            ) || 0
                          )
                        }
                        className="h-9 w-24 rounded-lg border border-black/[0.07] bg-white px-2 text-center text-xs text-[#211f20] outline-none focus:border-[#b7838e]"
                      />

                      <span className="text-[10px] text-[#aaa5a6]">
                        minutos
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-2xl bg-[#f3e5e8] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#817b7d]">
                    Bloqueio
                  </span>

                  <strong className="text-right text-xs text-[#9d6875]">
                    {blockAllDay
                      ? "Dia inteiro"
                      : `${blockTime || "--:--"} • ${formatDuration(blockDuration)}`}
                  </strong>
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-[#817b7d]">
                  Esse compromisso não será contado como cliente, atendimento ou entrada financeira.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  savingBlock
                }
                onClick={
                  saveCalendarBlock
                }
                className="h-11 w-full rounded-xl bg-[#b7838e] text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {savingBlock
                  ? "Salvando..."
                  : "Bloquear agenda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DaySchedule({
  selectedDay,
  appointments,
  blocks,
  getDuration,
  getAppointmentServices,
  onSelectTime,
  onBlock,
  onEdit,
  onDelete,
  onDeleteBlock,
  onWhatsApp,
  onFinalize,
  onMove,
}: {
  selectedDay: string;
  appointments: Appointment[];
  blocks: CalendarBlock[];
  getDuration: (
    appointment: Appointment
  ) => number;
  getAppointmentServices: (
    appointment: Appointment
  ) => SelectedService[];
  onSelectTime: (
    time: string
  ) => void;
  onBlock: (
    time: string
  ) => void;
  onEdit: (
    appointment: Appointment
  ) => void;
  onDelete: (
    appointment: Appointment
  ) => void;
  onDeleteBlock: (
    block: CalendarBlock
  ) => void;
  onWhatsApp: (
    appointment: Appointment
  ) => void;
  onFinalize: (
    appointment: Appointment
  ) => void;
  onMove: (
    appointment: Appointment,
    newTime: string
  ) => void;
}) {
  const [
    draggingAppointment,
    setDraggingAppointment,
  ] = useState<string | null>(
    null
  );

  const [
    dragOverTime,
    setDragOverTime,
  ] = useState<string | null>(
    null
  );

  const longPressTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const pointerStart =
    useRef<{
      x: number;
      y: number;
    } | null>(null);

  const draggingRef =
    useRef<string | null>(null);

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

  function clearLongPress() {
    if (
      longPressTimer.current
    ) {
      clearTimeout(
        longPressTimer.current
      );

      longPressTimer.current =
        null;
    }
  }

  function findDropTime(
    clientX: number,
    clientY: number
  ) {
    const element =
      document.elementFromPoint(
        clientX,
        clientY
      ) as HTMLElement | null;

    const slot =
      element?.closest(
        "[data-agenda-drop-time]"
      ) as HTMLElement | null;

    return (
      slot?.dataset
        .agendaDropTime ??
      null
    );
  }

  useEffect(() => {
    function handlePointerMove(
      event: PointerEvent
    ) {
      if (
        !draggingRef.current
      ) {
        return;
      }

      event.preventDefault();

      const dropTime =
        findDropTime(
          event.clientX,
          event.clientY
        );

      setDragOverTime(
        dropTime
      );
    }

    function handlePointerUp(
      event: PointerEvent
    ) {
      const appointmentId =
        draggingRef.current;

      if (!appointmentId) {
        return;
      }

      const dropTime =
        findDropTime(
          event.clientX,
          event.clientY
        );

      const appointment =
        appointments.find(
          (item) =>
            item.id ===
            appointmentId
        );

      if (
        appointment &&
        dropTime
      ) {
        const originalTime =
          appointment.scheduled_time?.slice(
            0,
            5
          );

        if (
          originalTime !==
          dropTime
        ) {
          onMove(
            appointment,
            dropTime
          );
        }
      }

      draggingRef.current =
        null;

      setDraggingAppointment(
        null
      );

      setDragOverTime(
        null
      );
    }

    function handlePointerCancel() {
      draggingRef.current =
        null;

      setDraggingAppointment(
        null
      );

      setDragOverTime(
        null
      );
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      {
        passive: false,
      }
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp
    );

    window.addEventListener(
      "pointercancel",
      handlePointerCancel
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerCancel
      );
    };
  }, [
    appointments,
    onMove,
  ]);

  useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, []);

  function startAppointmentDrag(
    appointment: Appointment,
    event: React.PointerEvent
  ) {
    if (
      event.pointerType ===
      "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    pointerStart.current =
      {
        x: event.clientX,
        y: event.clientY,
      };

    clearLongPress();

    longPressTimer.current =
      setTimeout(() => {
        draggingRef.current =
          appointment.id;

        setDraggingAppointment(
          appointment.id
        );

        if (
          typeof navigator !==
            "undefined" &&
          "vibrate" in navigator
        ) {
          navigator.vibrate(
            25
          );
        }
      }, 400);
  }

  function handleAppointmentPointerMove(
    event: React.PointerEvent
  ) {
    if (
      draggingRef.current
    ) {
      event.preventDefault();
      return;
    }

    if (
      !pointerStart.current
    ) {
      return;
    }

    const distance =
      Math.sqrt(
        Math.pow(
          event.clientX -
            pointerStart.current
              .x,
          2
        ) +
          Math.pow(
            event.clientY -
              pointerStart.current
                .y,
            2
          )
      );

    if (distance > 10) {
      clearLongPress();
      pointerStart.current =
        null;
    }
  }

  function handleAppointmentPointerUp() {
    clearLongPress();
    pointerStart.current =
      null;
  }

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

  blocks.forEach(
    (block) => {
      const start =
        block.all_day
          ? DAY_START_HOUR *
            60
          : timeToMinutes(
              block.start_time
            );

      if (
        start === null
      ) {
        return;
      }

      const duration =
        block.all_day
          ? (DAY_END_HOUR -
              DAY_START_HOUR) *
            60
          : block.duration_minutes;

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

  const slots: number[] =
    [];

  for (
    let minute =
      DAY_START_HOUR * 60;
    minute <=
      DAY_END_HOUR * 60;
    minute += SLOT_MINUTES
  ) {
    slots.push(
      minute
    );
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

  function blockAt(
    minute: number
  ) {
    return blocks.find(
      (block) => {
        const start =
          block.all_day
            ? DAY_START_HOUR *
              60
            : timeToMinutes(
                block.start_time
              );

        if (
          start === null
        ) {
          return false;
        }

        const duration =
          block.all_day
            ? (DAY_END_HOUR -
                DAY_START_HOUR) *
              60
            : block.duration_minutes;

        const end =
          start + duration;

        return (
          minute >= start &&
          minute < end
        );
      }
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#f3e5e8] px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#9d6875]">
            Agenda do dia
          </p>

          <p className="mt-1 text-sm font-semibold capitalize text-[#211f20]">
            {dateLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onBlock(
                "09:00"
              )
            }
            className="flex items-center gap-1.5 rounded-xl border border-[#b7838e]/20 bg-white px-3 py-2 text-xs font-semibold text-[#817b7d]"
          >
            <CalendarDays
              className="size-3.5"
              strokeWidth={
                1.7
              }
            />
            Bloquear
          </button>

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
              strokeWidth={
                1.8
              }
            />
            Agendar
          </button>
        </div>
      </div>

      {draggingAppointment && (
        <div className="mb-3 rounded-xl bg-[#b7838e] px-3 py-2 text-center text-[10px] font-medium text-white shadow-sm">
          Arraste até um horário livre e solte
        </div>
      )}

      {blocks.length >
        0 && (
        <div className="mb-3 rounded-2xl border border-[#b7838e]/10 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <CalendarDays
              className="size-3.5 text-[#9d6875]"
              strokeWidth={
                1.7
              }
            />

            <p className="text-[10px] font-semibold text-[#817b7d]">
              {blocks.length}{" "}
              {blocks.length ===
              1
                ? "bloqueio"
                : "bloqueios"}{" "}
              neste dia
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white shadow-sm">
        {slots.map(
          (minute) => {
            const appointment =
              appointmentAt(
                minute
              );

            const block =
              blockAt(
                minute
              );

            const occupied =
              occupiedSlots.has(
                minute
              );

            const slotTime =
              minutesToTime(
                minute
              );

            const isDropTarget =
              dragOverTime ===
              slotTime;

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

              const services =
                getAppointmentServices(
                  appointment
                );

              const remaining =
                Number(
                  appointment.total_amount
                ) -
                Number(
                  appointment.received_amount
                );

              const isDragging =
                draggingAppointment ===
                appointment.id;

              return (
                <div
                  key={
                    minute
                  }
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
                      <div
                        onPointerDown={(
                          event
                        ) =>
                          startAppointmentDrag(
                            appointment,
                            event
                          )
                        }
                        onPointerMove={
                          handleAppointmentPointerMove
                        }
                        onPointerUp={
                          handleAppointmentPointerUp
                        }
                        onPointerCancel={
                          handleAppointmentPointerUp
                        }
                        className={`select-none touch-none rounded-xl border border-[#b7838e]/20 bg-[#f3e5e8] p-3 transition ${
                          isDragging
                            ? "scale-[0.98] opacity-60 shadow-lg"
                            : "active:scale-[0.99]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#211f20]">
                              {client?.name ??
                                "Cliente"}
                            </p>

                            <div className="mt-2 space-y-1">
                              {services.map(
                                (
                                  service
                                ) => (
                                  <p
                                    key={
                                      service.id
                                    }
                                    className="truncate text-xs text-[#817b7d]"
                                  >
                                    ✨{" "}
                                    {
                                      service.name
                                    }
                                  </p>
                                )
                              )}
                            </div>

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
                              onPointerDown={(
                                event
                              ) =>
                                event.stopPropagation()
                              }
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

                        {services.length >
                          1 && (
                          <div className="mt-2 rounded-lg bg-white/70 px-2 py-1.5">
                            <p className="text-[9px] text-[#817b7d]">
                              {services.length}{" "}
                              serviços •{" "}
                              {formatDuration(
                                duration
                              )}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-[#b7838e]/15 pt-2">
                          <button
                            type="button"
                            onPointerDown={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
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
                            onPointerDown={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
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
                            onPointerDown={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
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

                        {isDragging && (
                          <p className="mt-2 text-center text-[9px] font-medium text-[#9d6875]">
                            Segure e arraste para mover
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

            if (
              block &&
              (
                block.all_day ||
                timeToMinutes(
                  block.start_time
                ) ===
                  minute
              )
            ) {
              const duration =
                block.all_day
                  ? (DAY_END_HOUR -
                      DAY_START_HOUR) *
                    60
                  : block.duration_minutes;

              return (
                <div
                  key={
                    minute
                  }
                  className="border-b border-black/[0.04] bg-[#f7f3f4]"
                >
                  <div className="flex min-h-[70px]">
                    <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 pt-3 text-center">
                      <span className="text-xs font-semibold text-[#aaa5a6]">
                        {block.all_day
                          ? "—"
                          : minutesToTime(
                              minute
                            )}
                      </span>
                    </div>

                    <div className="flex flex-1 items-center justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#817b7d]">
                          🔒{" "}
                          {
                            block.title
                          }
                        </p>

                        <p className="mt-1 text-[10px] text-[#aaa5a6]">
                          {block.all_day
                            ? "Dia inteiro bloqueado"
                            : `${formatDuration(
                                duration
                              )} • horário bloqueado`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onDeleteBlock(
                            block
                          )
                        }
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#b56f6f] shadow-sm"
                        aria-label={`Remover ${block.title}`}
                      >
                        <Trash2
                          className="size-3.5"
                          strokeWidth={
                            1.7
                          }
                        />
                      </button>
                    </div>
                  </div>

                  {duration >
                    SLOT_MINUTES &&
                    !block.all_day && (
                      <div className="flex min-h-[35px] border-t border-[#b7838e]/10 bg-[#faf7f7]">
                        <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 py-2 text-center text-[9px] text-[#aaa5a6]">
                          até
                        </div>

                        <div className="flex items-center px-3 text-[9px] text-[#aaa5a6]">
                          {minutesToTime(
                            minute +
                              duration
                          )}{" "}
                          • horário bloqueado
                        </div>
                      </div>
                    )}
                </div>
              );
            }

            const previousAppointment =
              appointments.find(
                (
                  appointment
                ) => {
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
                  key={
                    minute
                  }
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

            const previousBlock =
              blocks.find(
                (
                  currentBlock
                ) => {
                  const start =
                    currentBlock.all_day
                      ? DAY_START_HOUR *
                        60
                      : timeToMinutes(
                          currentBlock.start_time
                        );

                  if (
                    start ===
                    null
                  ) {
                    return false;
                  }

                  const duration =
                    currentBlock.all_day
                      ? (DAY_END_HOUR -
                          DAY_START_HOUR) *
                        60
                      : currentBlock.duration_minutes;

                  const end =
                    start +
                    duration;

                  return (
                    minute >
                      start &&
                    minute <
                      end
                  );
                }
              );

            if (
              previousBlock
            ) {
              return (
                <div
                  key={
                    minute
                  }
                  className="flex min-h-[46px] border-b border-black/[0.04] bg-[#f9f6f6]"
                >
                  <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 py-3 text-center text-[10px] text-[#aaa5a6]">
                    {minutesToTime(
                      minute
                    )}
                  </div>

                  <div className="flex flex-1 items-center px-3 text-[10px] text-[#aaa5a6]">
                    🔒 Horário bloqueado
                  </div>
                </div>
              );
            }

            return (
              <div
                key={
                  minute
                }
                data-agenda-drop-time={
                  slotTime
                }
                className={`flex min-h-[54px] border-b border-black/[0.04] transition ${
                  isDropTarget
                    ? "bg-[#f3e5e8] ring-2 ring-inset ring-[#b7838e]/30"
                    : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    onSelectTime(
                      slotTime
                    )
                  }
                  disabled={
                    occupied ||
                    Boolean(
                      draggingAppointment
                    )
                  }
                  className="flex min-w-0 flex-1 text-left transition active:bg-[#f8eef0] disabled:cursor-not-allowed"
                >
                  <div className="w-[62px] shrink-0 border-r border-black/[0.05] px-2 py-3 text-center text-[10px] font-medium text-[#817b7d]">
                    {slotTime}
                  </div>

                  <div className="flex flex-1 items-center px-3">
                    <span
                      className={`text-[10px] ${
                        isDropTarget
                          ? "font-semibold text-[#9d6875]"
                          : "text-[#c1bbbc]"
                      }`}
                    >
                      {isDropTarget
                        ? "Solte aqui"
                        : "Horário livre"}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onBlock(
                      slotTime
                    )
                  }
                  disabled={
                    occupied ||
                    Boolean(
                      draggingAppointment
                    )
                  }
                  className="flex w-[48px] shrink-0 items-center justify-center border-l border-black/[0.04] text-[#aaa5a6] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Bloquear às ${slotTime}`}
                >
                  <CalendarDays
                    className="size-3.5"
                    strokeWidth={
                      1.6
                    }
                  />
                </button>
              </div>
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
  blocks,
  onSelectDate,
}: {
  selectedMonth: Date;
  appointments: Appointment[];
  blocks: CalendarBlock[];
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

            const dayBlocks =
              blocks.filter(
                (
                  block
                ) =>
                  block.date ===
                  key
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
                  {dayBlocks
                    .slice(
                      0,
                      2
                    )
                    .map(
                      (
                        block
                      ) => (
                        <div
                          key={
                            block.id
                          }
                          className="truncate rounded-md bg-[#eee9ea] px-1.5 py-1 text-[8px] font-medium leading-none text-[#817b7d]"
                        >
                          🔒{" "}
                          {
                            block.title
                          }
                        </div>
                      )
                    )}

                  {dayAppointments
                    .slice(
                      0,
                      Math.max(
                        0,
                        3 -
                          dayBlocks.length
                      )
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

                  {dayAppointments.length +
                    dayBlocks.length >
                    3 && (
                    <p className="px-1 text-[8px] font-medium text-[#aaa5a6]">
                      +
                      {dayAppointments.length +
                        dayBlocks.length -
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
