import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TicketDatabase, UserProfile } from "@/lib/ticketing";
import { fixtureDb } from "./fixtures";

const { getSupabaseServerClient, getUser } = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient }));
vi.mock("server-only", () => ({}));

import { getAuthenticatedActor, isInternalActor } from "@/lib/auth";

function databaseWith(user: UserProfile): TicketDatabase {
  return {
    ...fixtureDb,
    users: [user],
  };
}

describe("authenticated profile status", () => {
  beforeEach(() => {
    getUser.mockReset();
    getSupabaseServerClient.mockReset();
    getSupabaseServerClient.mockResolvedValue({ auth: { getUser } });
  });

  it("accepts an active operational profile", async () => {
    const actor = { ...fixtureDb.users[0], status: "active" as const };
    getUser.mockResolvedValue({ data: { user: { id: actor.id } }, error: null });

    await expect(getAuthenticatedActor(databaseWith(actor))).resolves.toEqual(actor);
  });

  it.each(["invited", "disabled"] as const)(
    "rejects an authenticated profile with %s status",
    async (status) => {
      const actor = { ...fixtureDb.users[0], status };
      getUser.mockResolvedValue({ data: { user: { id: actor.id } }, error: null });

      await expect(getAuthenticatedActor(databaseWith(actor))).resolves.toBeNull();
    },
  );

  it("does not classify a disabled internal profile as an internal actor", () => {
    const internal = {
      ...fixtureDb.users.find((user) => user.role === "agent")!,
      status: "disabled" as const,
    };

    expect(isInternalActor(internal)).toBe(false);
  });
});
