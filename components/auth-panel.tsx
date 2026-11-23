import Link from "next/link";
import { Logo } from "./logo";

export function AuthPanel({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-teal-800 px-6 py-8 text-white lg:px-12">
        <span />
        <Logo variant="stacked" className="mx-auto mt-8 w-full max-w-sm" />
        <p className="mx-auto mt-6 max-w-sm text-center text-sm text-white/80">Portal de clientes de South Wind Global Services LLC.</p>
      </section>
      <section className="flex items-center px-4 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Logo variant="horizontal" className="h-14 w-auto rounded-xl" />
          </div>
          <h1 className="font-display text-4xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-teal-900/70">{lede}</p>
          {children}
        </div>
      </section>
    </div>
  );
}

export function AuthSwitch({ prompt, href, label }: { prompt: string; href: string; label: string }) {
  return (
    <p className="mt-6 text-sm text-teal-900/80">
      {prompt}{" "}
      <Link href={href} className="font-semibold text-teal-800 underline">
        {label}
      </Link>
    </p>
  );
}
