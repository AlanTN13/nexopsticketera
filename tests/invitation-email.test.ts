import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), constructor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class {
  emails = { send: mocks.send };
  constructor(key: string) { mocks.constructor(key); }
} }));
import { sendAccountInvitationEmail } from "@/lib/email-service";
const input = { to: "invite@example.test", name: "Alan <test>", activationUrl: "https://portal.nexopstech.com/auth/callback?token_hash=test-only&type=invite" };
beforeEach(() => { vi.clearAllMocks(); mocks.send.mockResolvedValue({ data: { id: "test-only" }, error: null }); });
afterEach(() => { vi.unstubAllEnvs(); });
describe("company invitation transport", () => {
  it("fails explicitly without a server-side key and never calls Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendAccountInvitationEmail(input)).rejects.toThrow("Falta configurar RESEND_API_KEY");
    expect(mocks.constructor).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("uses the configured server key, intended sender and activation URL", async () => {
    vi.stubEnv("RESEND_API_KEY", "unit-test-placeholder");
    await sendAccountInvitationEmail(input);
    expect(mocks.constructor).toHaveBeenCalledWith("unit-test-placeholder");
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: "NexOps Soporte <soporte@nexopstech.com>", replyTo: "info@nexopstech.com",
      to: [input.to], text: expect.stringContaining(input.activationUrl),
      html: expect.stringContaining("Alan &lt;test&gt;"),
    }));
    expect(JSON.stringify(mocks.send.mock.calls)).not.toContain("unit-test-placeholder");
  });
  it("reports provider rejection without exposing its raw response", async () => {
    vi.stubEnv("RESEND_API_KEY", "unit-test-placeholder");
    mocks.send.mockResolvedValue({ error: { name: "validation_error", message: "provider-only-diagnostic" } });
    await expect(sendAccountInvitationEmail(input)).rejects.toThrow("No pudimos enviar la invitación por email.");
  });
});
