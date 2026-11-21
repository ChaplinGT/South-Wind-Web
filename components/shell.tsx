"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./logo";

export function PortalShell({
  items,
  user,
  eyebrow,
  mock,
  children,
}: {
  items: { href: string; label: string }[];
  user: { name: string; email: string };
  eyebrow: string;
  mock: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
      <aside className={`${open ? "block" : "hidden"} border-b border-white/10 bg-teal-800 text-white md:block`}>
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link href={items[0]?.href ?? "/"}>
            <Logo variant="horizontal" className="h-11 w-auto" />
          </Link>
          <button className="text-sm md:hidden" onClick={() => setOpen(false)} type="button">
            Cerrar
          </button>
        </div>
        <p className="px-5 pb-2 text-xs uppercase tracking-[0.16em] text-white/60">{eyebrow}</p>
        <nav className="flex flex-col gap-1 px-3 pb-6">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden px-5 pb-6 md:block">
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-white/70">{user.email}</p>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button className="text-sm text-white/80 underline-offset-2 hover:underline" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between bg-teal-800 px-4 py-3 text-white md:hidden">
          <Logo variant="mark" className="h-10 w-10 rounded-xl" />
          <button type="button" className="text-sm font-semibold" onClick={() => setOpen((value) => !value)}>
            Menú
          </button>
        </div>
        {mock ? (
          <div className="bg-gold-100 px-4 py-2 text-center text-sm text-gold-700">
            Modo demostración. No se mueve dinero real.
          </div>
        ) : null}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
