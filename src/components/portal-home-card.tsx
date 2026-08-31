import Link from "next/link";
import { ReactNode } from "react";

export function PortalHomeCard({
  href,
  eyebrow,
  title,
  description,
  meta,
  children,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-52 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">{eyebrow}</p>
        <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.035em] text-slate-950">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
        <span className="font-medium text-slate-500">{meta}</span>
        <span className="font-semibold text-violet-700 transition group-hover:translate-x-0.5">Ingresar →</span>
      </div>
    </Link>
  );
}
