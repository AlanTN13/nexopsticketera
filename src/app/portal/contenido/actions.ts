"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addContentObservedAccount,
  retireContentAccount,
  selectMetaInstagramAccount,
  setContentAccountActive,
  setContentConnectorEnabled,
} from "@/lib/content-store";
import { refreshCurrentContentWorkspace } from "@/lib/content-sync";

export type ContentActionState = { error: string | null };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function actionError(error: unknown) {
  return { error: error instanceof Error ? error.message : "No pudimos completar la acción." };
}

function companySuffix(companyLookup: string) {
  return companyLookup ? `&company=${encodeURIComponent(companyLookup)}` : "";
}

export async function addObservedAccountAction(formData: FormData): Promise<ContentActionState> {
  try {
    const kind = value(formData, "kind");
    if (kind !== "competitor" && kind !== "reference") throw new Error("Elegí un tipo de cuenta válido.");
    await addContentObservedAccount({ kind, username: value(formData, "username"), note: value(formData, "note"), companyLookup: value(formData, "company") || undefined });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/portal/contenido");
  redirect(`/portal/contenido/cuentas?success=Cuenta%20agregada${companySuffix(value(formData, "company"))}`);
}

export async function setObservedAccountActiveAction(formData: FormData): Promise<ContentActionState> {
  try {
    await setContentAccountActive(value(formData, "accountId"), value(formData, "active") === "true", value(formData, "company") || undefined);
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/portal/contenido");
  redirect(`/portal/contenido/cuentas?source=action${companySuffix(value(formData, "company"))}`);
}

export async function retireObservedAccountAction(formData: FormData): Promise<ContentActionState> {
  try {
    await retireContentAccount(value(formData, "accountId"), value(formData, "company") || undefined);
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/portal/contenido");
  redirect(`/portal/contenido/cuentas?success=Cuenta%20retirada%20sin%20borrar%20su%20historial${companySuffix(value(formData, "company"))}`);
}

export async function selectMetaAccountAction(formData: FormData): Promise<ContentActionState> {
  try {
    await selectMetaInstagramAccount(value(formData, "instagramUserId"), value(formData, "company") || undefined);
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/portal/contenido");
  redirect(`/portal/contenido/fuentes?success=Cuenta%20oficial%20conectada${companySuffix(value(formData, "company"))}`);
}

export async function setContentConnectorEnabledAction(formData: FormData): Promise<ContentActionState> {
  try {
    await setContentConnectorEnabled(value(formData, "enabled") === "true", value(formData, "company") || undefined);
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/portal/contenido");
  redirect(`/portal/contenido/fuentes?success=Conector%20actualizado${companySuffix(value(formData, "company"))}`);
}

export async function refreshContentAction(formData: FormData): Promise<ContentActionState> {
  try {
    const requestKey = value(formData, "requestKey") || randomUUID();
    const result = await refreshCurrentContentWorkspace(requestKey, value(formData, "company") || undefined);
    if (!result.acquired) {
      const wait = Math.max(1, result.retryAfterSeconds || 1);
      redirect(`/portal/contenido/historial?wait=${wait}${companySuffix(value(formData, "company"))}`);
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return actionError(error);
  }
  revalidatePath("/portal/contenido");
  redirect(`/portal/contenido/historial?success=Recolecci%C3%B3n%20finalizada${companySuffix(value(formData, "company"))}`);
}
