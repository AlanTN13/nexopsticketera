import { BarChart3 } from "lucide-react";

const LOOKER_SANDBOX =
  "allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

export function KommoEmbed({
  companyName,
  url,
}: {
  companyName: string;
  url?: string;
}) {
  if (!url) {
    return (
      <div className="flex min-h-80 items-center justify-center bg-white p-6 text-center sm:p-10">
        <div className="max-w-lg">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <BarChart3 aria-hidden size={22} />
          </span>
          <h3 className="mt-4 text-lg font-bold text-slate-950">Reporte de Kommo no configurado</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta empresa tiene Métricas habilitado, pero todavía no cuenta con un reporte de Kommo disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-hidden bg-white">
      <iframe
        src={url}
        title={`Reporte de Kommo de ${companyName}`}
        loading="lazy"
        allowFullScreen
        sandbox={LOOKER_SANDBOX}
        referrerPolicy="strict-origin-when-cross-origin"
        className="block h-[78vh] min-h-[720px] w-full max-w-full border-0 md:min-h-[840px]"
      />
    </div>
  );
}
