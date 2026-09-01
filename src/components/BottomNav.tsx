import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Home,
  Plus,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";

const items = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: UsersRound },
  { to: "/movimentacoes", label: "Financeiro", icon: WalletCards },
] as const;

export function BottomNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute bottom-24 left-1/2 w-[calc(100%-40px)] max-w-md -translate-x-1/2 rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#211f20]">
                  Ação rápida
                </p>

                <p className="mt-1 text-xs text-[#817b7d]">
                  O que você deseja adicionar?
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-[#f6f3f3] text-[#817b7d]"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={1.7} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/agenda"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-[#f3e5e8] p-4 text-[#9d6875]"
              >
                <CalendarDays
                  className="size-5"
                  strokeWidth={1.6}
                />

                <div>
                  <p className="text-sm font-semibold">
                    Agendamento
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#8d6871]">
                    Novo atendimento
                  </p>
                </div>
              </Link>

              <Link
                to="/clientes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-[#faf9f8] p-4 text-[#9d6875]"
              >
                <UsersRound
                  className="size-5"
                  strokeWidth={1.6}
                />

                <div>
                  <p className="text-sm font-semibold text-[#211f20]">
                    Cliente
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#817b7d]">
                    Nova cliente
                  </p>
                </div>
              </Link>

              <Link
                to="/servicos"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-[#faf9f8] p-4 text-[#9d6875]"
              >
                <Sparkles
                  className="size-5"
                  strokeWidth={1.6}
                />

                <div>
                  <p className="text-sm font-semibold text-[#211f20]">
                    Serviço
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#817b7d]">
                    Novo procedimento
                  </p>
                </div>
              </Link>

              <Link
                to="/movimentacoes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-[#faf9f8] p-4 text-[#9d6875]"
              >
                <WalletCards
                  className="size-5"
                  strokeWidth={1.6}
                />

                <div>
                  <p className="text-sm font-semibold text-[#211f20]">
                    Financeiro
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#817b7d]">
                    Novo lançamento
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="relative grid grid-cols-5 items-end">
            {items.slice(0, 2).map(({ to, label, icon: Icon }) => (
              <NavItem
                key={to}
                to={to}
                label={label}
                icon={Icon}
              />
            ))}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={
                  open ? "Fechar ações" : "Nova ação"
                }
                className={`-mt-5 flex size-12 items-center justify-center rounded-full bg-[#b7838e] text-white shadow-lg shadow-[#b7838e]/20 ring-4 ring-white transition-transform ${
                  open ? "rotate-45" : ""
                }`}
              >
                <Plus
                  className="size-5"
                  strokeWidth={1.8}
                />
              </button>
            </div>

            {items.slice(2).map(({ to, label, icon: Icon }) => (
              <NavItem
                key={to}
                to={to}
                label={label}
                icon={Icon}
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Home;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[10px] font-medium text-[#8a8587]"
      activeProps={{
        className:
          "flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[10px] font-semibold text-[#9d6875]",
      }}
    >
      <Icon className="size-[18px]" strokeWidth={1.7} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
