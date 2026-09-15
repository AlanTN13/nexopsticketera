"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedActor } from "@/lib/auth";
import { getAppSnapshot, updateTicketStatuses } from "@/lib/app-store";
import { validateStatusUpdate } from "@/lib/ticket-status-update";
import { statusLabels } from "@/lib/ticketing";

export async function updateTicketStatusesAction(ids: unknown, status: unknown) {
  try {
    const input = validateStatusUpdate(ids, status);
    const db = await getAppSnapshot();
    const actor = await requireAuthenticatedActor(db);
    const result = await updateTicketStatuses({ ...input, actorId: actor.id });
    revalidatePath("/backoffice", "layout");
    revalidatePath("/portal", "layout");
    return {
      error: null,
      message: `${result.changed} de ${result.total} ticket(s) actualizado(s) a ${statusLabels[input.status]}.${result.changed < result.total ? " Los demás ya tenían ese estado." : ""}`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos guardar el cambio. Actualizá el listado antes de reintentar.", message: null };
  }
}
