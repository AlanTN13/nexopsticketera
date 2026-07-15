"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type AppModalProps = {
  triggerLabel?: string;
  title: string;
  description: string;
  children: ReactNode;
  maxWidthClassName?: string;
};

export function AppModal({
  triggerLabel = "+ Nuevo ticket",
  title,
  description,
  children,
  maxWidthClassName = "max-w-4xl",
}: AppModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-full bg-[linear-gradient(135deg,#6d5bd0,#7c5bff)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(124,91,255,0.22)] transition hover:translate-y-[-1px]"
      >
        {triggerLabel}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[rgba(15,23,42,0.48)] p-4 backdrop-blur-md sm:p-6"
              onClick={() => setOpen(false)}
            >
              <div className="flex min-h-full w-full items-center justify-center">
                <div
                  className={`relative w-full ${maxWidthClassName} rounded-[32px] border border-[rgba(17,24,39,0.08)] bg-white shadow-[0_30px_100px_rgba(17,24,39,0.22)]`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-[rgba(17,24,39,0.06)] px-6 py-5">
                    <div>
                      <h2 className="text-2xl font-black tracking-[-0.03em] text-[#111827]">{title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[#6b7280]">{description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white px-3 py-1.5 text-sm font-medium text-[#374151] transition hover:border-[#111827] hover:text-[#111827]"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="max-h-[min(78vh,820px)] overflow-y-auto px-6 py-5">{children}</div>
                </div>
              </div>
            </div>
          , document.body)
        : null}
    </>
  );
}

export function PortalTicketModal(props: AppModalProps) {
  return <AppModal {...props} />;
}
