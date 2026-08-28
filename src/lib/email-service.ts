import "server-only";

import { Resend } from "resend";

import { NotificationEmail, escapeHtml, validEmail } from "@/lib/notification-events";
export { getPublicAppUrl } from "@/lib/public-app-url";

const FROM = "NexOps Soporte <soporte@nexopstech.com>";
const REPLY_TO = "info@nexopstech.com";

export async function sendAccountInvitationEmail(input: {
  to: string;
  name: string;
  activationUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Falta configurar RESEND_API_KEY para enviar invitaciones.");
  }

  const resend = new Resend(apiKey);
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.activationUrl);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [input.to],
    replyTo: REPLY_TO,
    subject: "Activá tu acceso a NexOps",
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e2e8f0;border-radius:14px"><tr><td style="background:#172033;padding:22px 28px;color:#fff;font-size:20px;font-weight:800">NexOps</td></tr><tr><td style="padding:30px 28px"><h1 style="font-size:23px;margin:0 0 12px">Activá tu cuenta</h1><p style="font-size:15px;line-height:1.6;color:#475569">Hola ${safeName}, te invitaron a usar la Ticketera NexOps. Elegí tu contraseña desde el botón siguiente.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#5b48c7;border-radius:8px;color:#fff;font-size:15px;font-weight:700;padding:12px 20px;text-decoration:none">Activar cuenta</a></p><p style="font-size:13px;line-height:1.5;color:#64748b">Si no esperabas esta invitación, podés ignorar el mensaje.</p></td></tr></table></td></tr></table></body></html>`,
    text: `Hola ${input.name},\n\nTe invitaron a usar la Ticketera NexOps. Activá tu cuenta y elegí una contraseña desde este enlace:\n${input.activationUrl}\n\nSi no esperabas esta invitación, podés ignorar el mensaje.`,
  });

  if (error) {
    throw new Error("No pudimos enviar la invitación por email.");
  }
}

export async function sendNotificationEmail(email: NotificationEmail | null) {
  if (!email || !validEmail(email.to)) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] Email omitido: RESEND_API_KEY no está configurada.");
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: FROM,
        to: [email.to],
        replyTo: REPLY_TO,
        subject: email.subject,
        html: renderHtml(email),
        text: renderText(email),
      },
      { idempotencyKey: email.idempotencyKey },
    );

    if (error) {
      console.error("[notifications] Resend rechazó un email.", {
        event: email.idempotencyKey.split("/")[0],
        type: error.name,
      });
    }
  } catch (error) {
    console.error("[notifications] No se pudo enviar un email.", {
      event: email.idempotencyKey.split("/")[0],
      type: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function renderHtml(email: NotificationEmail) {
  const details = email.details
    .map(
      ({ label, value }) =>
        `<tr><td style="padding:7px 12px 7px 0;color:#64748b;font-size:14px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:7px 0;color:#172033;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const content = email.content
    ? `<div style="margin:24px 0 0"><p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(email.contentLabel ?? "Detalle")}</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#334155;font-size:14px;line-height:1.6;padding:16px;white-space:pre-wrap">${escapeHtml(truncate(email.content, 2400))}</div></div>`
    : "";

  return `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(email.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden"><tr><td style="background:#172033;padding:22px 28px;color:#fff"><div style="font-size:20px;font-weight:800;letter-spacing:.02em">NexOps</div><div style="color:#cbd5e1;font-size:12px;margin-top:3px">Soporte y operaciones</div></td></tr><tr><td style="padding:30px 28px"><h1 style="font-size:23px;line-height:1.25;margin:0 0 12px;color:#172033">${escapeHtml(email.heading)}</h1><p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#475569">${escapeHtml(email.intro)}</p><table role="presentation" cellspacing="0" cellpadding="0">${details}</table>${content}<div style="margin-top:28px"><a href="${escapeHtml(email.ticketUrl)}" style="display:inline-block;background:#14b8a6;border-radius:8px;color:#fff;font-size:15px;font-weight:700;padding:12px 20px;text-decoration:none">Ver ticket</a></div></td></tr><tr><td style="border-top:1px solid #e2e8f0;padding:18px 28px;color:#64748b;font-size:12px;line-height:1.5">Este mensaje fue enviado por NexOps Soporte. Podés responder a este email para contactar al equipo.</td></tr></table></td></tr></table></body></html>`;
}

function renderText(email: NotificationEmail) {
  const lines = [
    "NexOps Soporte",
    "",
    email.heading,
    email.intro,
    "",
    ...email.details.map(({ label, value }) => `${label}: ${value}`),
  ];
  if (email.content) lines.push("", `${email.contentLabel ?? "Detalle"}:`, truncate(email.content, 2400));
  lines.push("", `Ver ticket: ${email.ticketUrl}`, "", "Reply-To: info@nexopstech.com");
  return lines.join("\n");
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
