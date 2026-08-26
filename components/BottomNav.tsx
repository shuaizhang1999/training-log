"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Two-tab bottom bar — everything important lives in thumb reach. */
export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const tabs = [
    {
      href: "/",
      label: "Log",
      icon: (
        // barbell
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2 12h2m16 0h2M7 12h10M5 8v8M9 6v12M15 6v12M19 8v8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: "/history",
      label: "History",
      icon: (
        // trend line
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 20h18M4 16l4-5 4 3 7-8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-safe backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex h-16 flex-1 flex-col items-center justify-center gap-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] active:scale-95 ${
                isActive ? "text-accent" : "text-dim"
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
