import { redirect } from "next/navigation";

import { getAuthenticatedActor, isInternalActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  redirect(isInternalActor(actor) ? `/backoffice?actor=${encodeURIComponent(actor.id)}` : "/portal");
}
