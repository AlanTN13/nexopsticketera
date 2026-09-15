import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// PostgreSQL with the Supabase service schemas represented locally. The app's
// tables, grants, policies, triggers and functions come from the real migrations.
export async function createTicketPostgres() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    grant usage on schema auth, storage to authenticated, anon;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner_id text, metadata jsonb);
    alter table storage.objects enable row level security;
  `);
  for (const file of readdirSync(join(process.cwd(), "supabase/migrations")).filter((file) => file.endsWith(".sql")).sort()) {
    // gen_random_uuid is built into PostgreSQL; pgcrypto installation is not
    // available in this WASM distribution and no ticket function needs it.
    const sql = readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
      .replace('create extension if not exists "pgcrypto";', "");
    try { await db.exec(sql); } catch (error) {
      throw new Error(`Migration ${file}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return db;
}
