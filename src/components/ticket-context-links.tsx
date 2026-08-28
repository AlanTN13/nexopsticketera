import { getSafeTicketContextUrls } from "@/lib/ticket-context-urls";

export function TicketContextLinks({ urls }: { urls: string[] }) {
  const safeUrls = getSafeTicketContextUrls(urls);
  if (safeUrls.length === 0) return null;

  return (
    <div className="grid gap-2" aria-label="Enlaces de contexto">
      {safeUrls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-violet-700 underline"
        >
          {url}
        </a>
      ))}
    </div>
  );
}
