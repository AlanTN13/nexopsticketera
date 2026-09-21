"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Retain links issued by the original operation screen without rendering its full history. */
export function RadarLegacyRunLink({ historyHref }: { historyHref: string }) {
  const router = useRouter();
  useEffect(() => {
    function follow() {
      const match = /^#run-([0-9a-f-]{36})$/i.exec(window.location.hash);
      if (!match) return;
      const url = new URL(historyHref, window.location.origin);
      if (window.location.pathname === url.pathname && new URLSearchParams(window.location.search).get("run") === match[1]) return;
      url.searchParams.set("run", match[1]);
      router.replace(`${url.pathname}${url.search}${window.location.hash}`);
    }
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [historyHref, router]);
  return null;
}
