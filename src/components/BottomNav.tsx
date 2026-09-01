import { Link } from "@tanstack/react-router";
import {
  Home,
  CalendarDays,
  CircleDollarSign,
  UsersRound,
} from "lucide-react";

const items = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/a-receber", label: "A receber", icon: CircleDollarSign },
  { to: "/clientes", label: "Clientes", icon: UsersRound },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch px-3 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1.5 py-3 text-[10px] font-medium tracking-wide text-muted-foreground transition-all"
              activeProps={{
                className:
                  "flex flex-col items-center gap-1.5 py-3 text-[10px] font-semibold tracking-wide text-income",
              }}
            >
              <Icon className="size-[19px]" strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
