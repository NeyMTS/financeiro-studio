import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({
  title,
  subtitle,
  action,
  topContent,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  topContent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf9f8] text-[#211f20]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-6">
        {topContent ? (
          <div className="mb-6">
            {topContent}
          </div>
        ) : null}

        <header className="mb-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[#211f20]">
              {title}
            </h1>

            {subtitle ? (
              <p className="mt-1 text-sm text-[#817b7d]">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? (
            <div className="shrink-0">
              {action}
            </div>
          ) : null}
        </header>

        <div className="pb-4">
          {children}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.05] bg-white px-5 py-10 text-center text-sm text-[#817b7d] shadow-sm">
      {text}
    </div>
  );
}
