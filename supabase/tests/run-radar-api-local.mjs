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
    create table public.portal_modules(key text primary key,active boolean);
    create table public.user_company_assignments(user_id uuid,company_id uuid);
    create table public.user_module_permissions(user_id uuid,company_id uuid,module text,access_level text);
    create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb->>'role' $$;
    create function private.is_platform_admin() returns boolean language sql stable as $$ select exists(select 1 from public.users where id=auth.uid() and role='platform_admin' and status='active') $$;
    create function private.has_module_access(uuid,text,text) returns boolean language sql stable as $$ select false $$;
    grant usage on schema public,private,auth to anon,authenticated,service_role;
  `);
  // The new authorized decision uses this existing actor-aware access helper.
  const accessMigration = await readFile(new URL('migrations/20260901102427_company_module_access_v2.sql', supabaseDirectory), 'utf8');
  await db.exec(accessMigration.slice(accessMigration.indexOf('create or replace function private.user_has_module_access('), accessMigration.indexOf('create or replace function private.has_module_access(')));
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
  await db.exec(await readFile(new URL('migrations/20260921181608_radar_pilot_six_dollar_extension.sql', supabaseDirectory), 'utf8'));
  const [beforeNine, afterNine] = (await readFile(new URL('tests/radar_pilot_nine_dollar_extension.sql', supabaseDirectory), 'utf8')).split('-- APPLY EXTENSION HERE');
  await db.exec(beforeNine);
  await db.exec(await readFile(new URL('migrations/20260921202253_radar_pilot_nine_dollar_extension.sql', supabaseDirectory), 'utf8'));
  await db.exec(afterNine);
  console.log('Radar pilot USD9 extension regression PASS (isolated PGlite)');
  // The USD9 regression rolls back its fixture and migration together.
  await db.exec(await readFile(new URL('migrations/20260921202253_radar_pilot_nine_dollar_extension.sql', supabaseDirectory), 'utf8'));
  await db.exec(await readFile(new URL('migrations/20260921232941_radar_read_only_admission.sql', supabaseDirectory), 'utf8'));
  await db.exec(await readFile(new URL('tests/radar_read_only_admission.sql', supabaseDirectory), 'utf8'));
  console.log('Radar read-only admission regression PASS (isolated PGlite)');
  await db.exec(await readFile(new URL('tests/radar_postponed_decisions.sql', supabaseDirectory), 'utf8'));
  console.log('Radar postponed decisions regression PASS (isolated PGlite)');
  const [beforeReconciled, afterReconciled] = (await readFile(new URL('tests/radar_reconciled_budget.sql', supabaseDirectory), 'utf8')).split('-- APPLY RECONCILED MIGRATION HERE');
  await db.exec(beforeReconciled);
  await db.exec(await readFile(new URL('migrations/20260922005607_radar_reconciled_cost_budget.sql', supabaseDirectory), 'utf8'));
  await db.exec(afterReconciled);
  console.log('Radar reconciled USD5 cost budget regression PASS (isolated PGlite)');
  // Rebuild the historical fixture after its rollback; verify transition from consumed agent quota.
  await db.exec(beforeReconciled);
  await db.exec(await readFile(new URL('migrations/20260922005607_radar_reconciled_cost_budget.sql', supabaseDirectory), 'utf8'));
  const [beforeManual, afterManual] = (await readFile(new URL('tests/radar_manual_admission.sql', supabaseDirectory), 'utf8')).split('-- APPLY MANUAL MIGRATION HERE');
  await db.exec(beforeManual);
  await db.exec(await readFile(new URL('migrations/20260922014442_radar_manual_admission.sql', supabaseDirectory), 'utf8'));
  const [beforeFive, afterFive] = (await readFile(new URL('tests/radar_five_call_telemetry.sql', supabaseDirectory), 'utf8')).split('-- APPLY FIVE CALL MIGRATION HERE');
  await db.exec(beforeFive);
  await db.exec(await readFile(new URL('migrations/20260925134445_radar_five_call_telemetry.sql', supabaseDirectory), 'utf8'));
  await db.exec(afterFive);
  console.log('Radar five-call telemetry regression PASS (isolated PGlite)');
  await db.exec(afterManual);
  console.log('Radar manual admission regression PASS (isolated PGlite)');
} catch (error) {
  console.error('Radar API SQL regression FAILED:', error.message, error.where ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
