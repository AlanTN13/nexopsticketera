import { describe, expect, it, vi } from "vitest";

import {
  NEXOPS_NOTIFICATION_EMAIL,
  buildCommentNotification,
  buildStatusChangedNotification,
  buildTicketCreatedNotification,
  escapeHtml,
  persistThenNotify,
} from "@/lib/notification-events";
import { clientA, companyA, nexopsAgent, ticketA } from "./fixtures";

const ticketUrl = "https://soporte.nexopstech.com/portal/tickets/nex-1001";
const context = {
  actor: clientA,
  company: companyA,
  creator: clientA,
  ticket: { ...ticketA, description: "No puedo ingresar al sistema" },
  ticketUrl,
};

describe("ticket email notifications", () => {
  it("creates one internal notification for a new client ticket", () => {
    const email = buildTicketCreatedNotification(context);

    expect(email).not.toBeNull();
    expect(email?.to).toBe(NEXOPS_NOTIFICATION_EMAIL);
    expect(email?.idempotencyKey).toBe(`ticket-created/${ticketA.id}`);
    expect(email?.content).toContain("No puedo ingresar");
  });

  it("notifies NexOps for an external client message", () => {
    const email = buildCommentNotification({
      ...context,
      commentId: "comment-client-1",
      body: "Sigue ocurriendo",
      visibility: "external",
    });

    expect(email?.to).toBe(NEXOPS_NOTIFICATION_EMAIL);
    expect(email?.subject).toBe(`[NexOps] Nuevo mensaje en ${ticketA.code}`);
  });

  it("notifies the ticket creator for an external NexOps response", () => {
    const email = buildCommentNotification({
      ...context,
      actor: nexopsAgent,
      commentId: "comment-agent-1",
      body: "Ya estamos revisando el acceso",
      visibility: "external",
    });

    expect(email?.to).toBe(clientA.email);
    expect(email?.content).toContain("revisando");
  });

  it("never creates an email for an internal note", () => {
    const email = buildCommentNotification({
      ...context,
      actor: nexopsAgent,
      commentId: "internal-1",
      body: "SECRETO INTERNO",
      visibility: "internal",
    });

    expect(email).toBeNull();
  });

  it("notifies the creator for a real status change", () => {
    const email = buildStatusChangedNotification({
      ...context,
      actor: nexopsAgent,
      previousStatus: "new",
      newStatus: "analysis",
    });

    expect(email?.to).toBe(clientA.email);
    expect(email?.details).toContainEqual({ label: "Estado anterior", value: "Nuevo" });
    expect(email?.details).toContainEqual({ label: "Estado nuevo", value: "En análisis" });
  });

  it("does not notify when status stays the same", () => {
    expect(
      buildStatusChangedNotification({
        ...context,
        actor: nexopsAgent,
        previousStatus: "new",
        newStatus: "new",
      }),
    ).toBeNull();
  });

  it("keeps the persisted mutation when notification delivery fails", async () => {
    const persist = vi.fn().mockResolvedValue({ id: "saved" });
    const notify = vi.fn().mockRejectedValue(new Error("Resend unavailable"));

    await expect(persistThenNotify(persist, notify)).resolves.toEqual({ id: "saved" });
    expect(persist).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
  });

  it("does not model the initial description as a second message", () => {
    const email = buildTicketCreatedNotification(context);

    expect(email?.idempotencyKey).toBe(`ticket-created/${ticketA.id}`);
    expect(email?.heading).toBe("Nuevo ticket recibido");
    expect(email?.contentLabel).toBe("Descripción inicial");
  });

  it("does not expose internal-note content in client emails", () => {
    const internalNote = "SECRETO INTERNO: credencial temporal";
    const externalEmail = buildCommentNotification({
      ...context,
      actor: nexopsAgent,
      commentId: "comment-agent-2",
      body: "Respuesta pública segura",
      visibility: "external",
    });

    expect(JSON.stringify(externalEmail)).not.toContain(internalNote);
    expect(JSON.stringify(externalEmail)).toContain("Respuesta pública segura");
  });

  it("escapes user-generated HTML before rendering templates", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & contenido')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; contenido",
    );
  });
});
