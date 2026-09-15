import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTicketPostgres } from "./helpers/ticket-postgres";

let db: PGlite;
const admin = "10000000-0000-0000-0000-000000000001";
const agent = "10000000-0000-0000-0000-000000000002";
const client = "10000000-0000-0000-0000-000000000003";
const companyA = "20000000-0000-0000-0000-000000000001";
const companyB = "20000000-0000-0000-0000-000000000002";
const ticketA = "30000000-0000-0000-0000-000000000001";
const ticketA2 = "30000000-0000-0000-0000-000000000002";
const ticketB = "30000000-0000-0000-0000-000000000003";
async function actor(id: string, role = "authenticated") {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claims', '${JSON.stringify({ sub: id, role })}', false);`);
}
async function batch(ids: string[], status = "on_hold") {
  return db.query<{ ticket_id: string; previous_status: string; status_history_id: string | null }>("select * from public.update_ticket_statuses_with_history($1::uuid[], $2::public.ticket_status)", [ids, status]);
}
async function allTickets() {
  await actor(admin);
  return (await db.query("select id, status, priority, assigned_to_id from public.tickets order by id")).rows;
}

beforeAll(async () => {
  db = await createTicketPostgres();
  await db.exec(`
    insert into auth.users (id, email) values ('${admin}', 'admin@test.invalid'), ('${agent}', 'agent@test.invalid'), ('${client}', 'client@test.invalid');
    insert into public.users (id, name, email, role, status) values ('${admin}', 'Admin', 'admin@test.invalid', 'platform_admin', 'active');
    select set_config('request.jwt.claims', '{"sub":"${admin}","role":"authenticated"}', false);
    insert into public.companies (id, name, slug) values ('${companyA}', 'Company A', 'company-a'), ('${companyB}', 'Company B', 'company-b');
    insert into public.users (id, company_id, name, email, role, status) values
      ('${agent}', null, 'Agent', 'agent@test.invalid', 'agent', 'active'),
      ('${client}', '${companyA}', 'Client', 'client@test.invalid', 'client_admin', 'active');
    insert into public.user_company_assignments(user_id, company_id, assigned_by) values ('${agent}', '${companyA}', '${admin}');
    insert into public.user_module_permissions(user_id, company_id, module, access_level, granted_by) values
      ('${agent}', '${companyA}', 'support', 'operate', '${admin}'), ('${client}', '${companyA}', 'support', 'admin', '${admin}');
    insert into public.tickets(id, code, company_id, title, description, type, area, created_by_id, assigned_to_id, priority) values
      ('${ticketA}', 'NEX-1001', '${companyA}', 'Uno', 'Descripción de prueba', 'issue', 'website', '${client}', '${agent}', 'critical'),
      ('${ticketA2}', 'NEX-1002', '${companyA}', 'Dos', 'Descripción de prueba', 'issue', 'website', '${client}', null, 'low'),
      ('${ticketB}', 'NEX-1003', '${companyB}', 'Tres', 'Descripción de prueba', 'issue', 'website', '${admin}', null, 'medium');
  `);
}, 30000);
afterAll(async () => { await db?.close(); });

describe("status batch: PostgreSQL and V2 permissions", () => {
  it("changes two visible tickets atomically, preserving priority/assignee and recording history", async () => {
    await actor(agent);
    const result = await batch([ticketA2, ticketA, ticketA]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((row) => row.previous_status === "new" && row.status_history_id)).toBe(true);
    const tickets = await allTickets();
    expect(tickets[0]).toMatchObject({ status: "on_hold", priority: "critical", assigned_to_id: agent });
    expect(tickets[1]).toMatchObject({ status: "on_hold", priority: "low", assigned_to_id: null });
    expect(tickets[2]).toMatchObject({ status: "new" });
  });
  it("does not duplicate history on retry or same-state submission", async () => {
    await actor(agent);
    expect((await batch([ticketA, ticketA2])).rows.every((row) => row.status_history_id === null)).toBe(true);
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.ticket_history where event_type='status_changed'")).rows[0].n).toBe(2);
  });
  it("rejects cross-tenant mixed batches without partial writes or history", async () => {
    await actor(agent);
    await expect(batch([ticketA, ticketB], "closed")).rejects.toThrow("No autorizado");
    expect((await allTickets())[0]).toMatchObject({ status: "on_hold" });
  });
  it("rejects nonexistent IDs without partial writes", async () => {
    await actor(agent);
    await expect(batch([ticketA, "30000000-0000-0000-0000-000000000099"], "closed")).rejects.toThrow("No autorizado");
    expect((await allTickets())[0]).toMatchObject({ status: "on_hold" });
  });
  it("client admin cannot change status, even with support admin", async () => {
    await actor(client);
    await expect(batch([ticketA])).rejects.toThrow("No autorizado");
  });
  it("anonymous cannot execute the RPC", async () => {
    await actor(client, "anon");
    await expect(batch([ticketA])).rejects.toThrow("permission denied");
  });
  it("checks revoked permissions and disabled modules even for no-ops", async () => {
    await actor(admin);
    await db.exec(`reset role; update public.user_module_permissions set access_level='view' where user_id='${agent}';`);
    await actor(agent);
    await expect(batch([ticketA])).rejects.toThrow("No autorizado");
    await actor(admin);
    await db.exec(`reset role; update public.user_module_permissions set access_level='operate' where user_id='${agent}'; update public.company_modules set enabled=false where company_id='${companyA}' and module='support';`);
    await actor(agent);
    await expect(batch([ticketA])).rejects.toThrow("No autorizado");
    await actor(admin);
    await db.exec(`reset role; update public.company_modules set enabled=true where company_id='${companyA}' and module='support';`);
  });
  it("rolls back earlier changes and history if a later ticket fails inside the shared workflow", async () => {
    await actor(admin);
    await db.exec(`reset role;
      create function pg_temp.fail_second_ticket() returns trigger language plpgsql as $$
      begin if new.id = '${ticketA2}' then raise exception 'Injected downstream failure'; end if; return new; end $$;
      create trigger qa_fail_second before update on public.tickets for each row execute function pg_temp.fail_second_ticket();`);
    await actor(agent);
    await expect(batch([ticketA, ticketA2], "resolved")).rejects.toThrow("Injected downstream failure");
    expect((await allTickets())[0]).toMatchObject({ status: "on_hold" });
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.ticket_history where event_type='status_changed'")).rows[0].n).toBe(2);
    await db.exec("reset role; drop trigger qa_fail_second on public.tickets;");
  });
  it("rejects invalid states, null, empty and oversized batches", async () => {
    await actor(admin);
    await expect(batch([ticketA], "invalid")).rejects.toThrow("invalid input value");
    await expect(batch([])).rejects.toThrow("Seleccioná");
    await expect(batch(Array(101).fill(ticketA))).rejects.toThrow("Seleccioná");
    await expect(db.query("select * from public.update_ticket_statuses_with_history(null, 'on_hold')")).rejects.toThrow("Seleccioná");
  });
  it("keeps detail workflow compatible with On Hold and allows internal admin across companies", async () => {
    await actor(admin);
    await db.query("select public.update_ticket_workflow_with_history($1, 'on_hold', 'high', null)", [ticketB]);
    expect((await batch([ticketA, ticketB], "in_progress")).rows).toHaveLength(2);
  });
});
