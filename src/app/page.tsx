import { redirect } from "next/navigation";

import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);

  redirect(actor ? "/portal" : "/login");
}
