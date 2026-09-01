import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Home,
  Plus,
  UsersRound,
  WalletCards,
} from "lucide-react";

const items = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: UsersRound },
  { to: "/movimentacoes", label: "Financeiro", icon: WalletCards },
] as const;

export function BottomNav() {
  return (
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
            <Link
              to="/movimentacoes"
              search={{ novo: "1" }}
              aria-label="Novo lançamento"
              className="-mt-5 flex size-12 items-center justify-center rounded-full bg-[#b7838e] text-white shadow-lg shadow-[#b7838e]/20 ring-4 ring-white transition-transform active:scale-95"
            >
              <Plus className="size-5" strokeWidth={1.8} />
            </Link>
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
