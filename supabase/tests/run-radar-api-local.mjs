/**
 * Disposable PostgreSQL-compatible regression using PGlite (no production access).
 * Install PGlite outside this repository, then run:
 * PGLITE_MODULE_PATH=/tmp/radar-db-tests/node_modules/@electric-sql/pglite \
 *   node supabase/tests/run-radar-api-local.mjs
 *
 * Only prerequisite auth/company tables and non-Radar access helpers are fixtures.
 * All Radar schemas/functions below are the actual migration SQL. This focused
 * harness does not replace full Supabase RLS or multi-session concurrency tests.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite';
const { PGlite } = await import(pathToFileURL(require.resolve(modulePath)).href);
const supabaseDirectory = new URL('../', import.meta.url);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text);
    create table public.companies(id uuid primary key);
    create table public.users(id uuid primary key references auth.users(id),company_id uuid,name text,email text,role text,status text);
    create table public.company_modules(company_id uuid,module text,settings jsonb,enabled boolean);
    create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb->>'role' $$;
    create function private.is_platform_admin() returns boolean language sql stable as $$ select exists(select 1 from public.users where id=auth.uid() and role='platform_admin' and status='active') $$;
    create function private.has_module_access(uuid,text,text) returns boolean language sql stable as $$ select false $$;
    grant usage on schema public,private,auth to anon,authenticated,service_role;
  `);
  const migrations = [
    '20260901131322_radar_control_plane_v1.sql',
    '20260901180902_radar_github_queue_bridge.sql',
    '20260901194500_radar_manual_publication_gate.sql',
    '20260915174740_radar_api_bounded_state.sql',
    '20260917122641_radar_n8n_atomic_completion.sql',
  ];
  for (const migration of migrations) {
    await db.exec(await readFile(new URL(`migrations/${migration}`, supabaseDirectory), 'utf8'));
    console.log(`Migration OK: ${migration}`);
  }
  await db.exec(await readFile(new URL('tests/radar_api_bounded_state.sql', supabaseDirectory), 'utf8'));
  console.log('Radar API SQL regression PASS (isolated PGlite, prerequisite fixtures)');
  const [beforeExtension, afterExtension] = (await readFile(new URL('tests/radar_pilot_extension.sql', supabaseDirectory), 'utf8')).split('-- APPLY EXTENSION HERE');
  await db.exec(beforeExtension);
  await db.exec(await readFile(new URL('migrations/20260921181608_radar_pilot_six_dollar_extension.sql', supabaseDirectory), 'utf8'));
  await db.exec(afterExtension);
  console.log('Radar pilot USD6 extension regression PASS (isolated PGlite)');
} catch (error) {
  console.error('Radar API SQL regression FAILED:', error.message, error.where ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
