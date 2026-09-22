/** Isolated real PostgreSQL regression. Never accepts a non-local database URL.
 * RADAR_TEST_PG_URL=postgresql://postgres:...@localhost:5432/postgres node ...
 * Or RADAR_TEST_PG_CONTAINER=radar-budget-pg for the temporary local container.
 * Creates/drops its own disposable database; never edits the supplied database.
 */
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const container = process.env.RADAR_TEST_PG_CONTAINER;
const supplied = process.env.RADAR_TEST_PG_URL;
if (!supplied && !container) throw new Error('Set RADAR_TEST_PG_URL (localhost only) or RADAR_TEST_PG_CONTAINER.');
const url = supplied ? new URL(supplied) : null;
if (url && (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || !['postgres:','postgresql:'].includes(url.protocol))) throw new Error('Only isolated local PostgreSQL is allowed.');
if (!url && !/^radar-budget-[a-z0-9-]+$/.test(container)) throw new Error('Container must be a dedicated radar-budget-* test container.');
const database = `radar_budget_${process.pid}_${Date.now()}`;
function execute(sql, db = null, onText = () => {}) {
  let command; let args;
  if (url) {
    const target = new URL(url); if (db) target.pathname = `/${db}`;
    command = process.env.RADAR_TEST_PSQL ?? 'psql'; args = [target.toString(), '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'];
  } else { command = 'docker'; args = ['exec','-i',container,'psql','-U','postgres','-d',db ?? 'postgres','-X','-A','-t','-v','ON_ERROR_STOP=1']; }
  return new Promise((resolve,reject) => {
    const child=spawn(command,args,{stdio:['pipe','pipe','pipe']}); let stdout=''; let stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;onText(stdout);}); child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject); child.on('close',code=>resolve({code,stdout,stderr})); child.stdin.end(sql);
  });
}
async function checked(sql, db = database) { const result=await execute(sql,db); assert.equal(result.code,0,result.stderr); return result.stdout; }
let created=false;
try {
  await checked(`create database ${database};`,null); created=true;
  const harness=await readFile(new URL('tests/run-radar-api-local.mjs',root),'utf8');
  let prerequisites=harness.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
  prerequisites=prerequisites.replace('create role anon; create role authenticated; create role service_role bypassrls;',()=>`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  end $$;`);
  const access=await readFile(new URL('migrations/20260901102427_company_module_access_v2.sql',root),'utf8');
  let setup=prerequisites+access.slice(access.indexOf('create or replace function private.user_has_module_access('),access.indexOf('create or replace function private.has_module_access('));
  for (const name of ['20260901131322_radar_control_plane_v1.sql','20260901180902_radar_github_queue_bridge.sql','20260901194500_radar_manual_publication_gate.sql','20260915174740_radar_api_bounded_state.sql','20260917122641_radar_n8n_atomic_completion.sql','20260921181608_radar_pilot_six_dollar_extension.sql','20260921202253_radar_pilot_nine_dollar_extension.sql','20260921232941_radar_read_only_admission.sql']) setup+=await readFile(new URL(`migrations/${name}`,root),'utf8');
  const fixtures=(await readFile(new URL('tests/radar_reconciled_budget.sql',root),'utf8')).split('-- APPLY RECONCILED MIGRATION HERE')[0];
  setup+=fixtures+await readFile(new URL('migrations/20260922005607_radar_reconciled_cost_budget.sql',root),'utf8')+await readFile(new URL('migrations/20260922014442_radar_manual_admission.sql',root),'utf8')+'\ncommit;';
  await checked(setup);
  await checked(`insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
    values ('b2000000-0000-0000-0000-000000000001','nexops','a1000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001','review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds'),
    ('b2000000-0000-0000-0000-000000000002','nexops-api-pilot','a1000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000002','review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds');`);
  let unlockReady; const ready=new Promise(resolve=>{unlockReady=resolve;});
  const first=execute(`begin; select (public.reserve_radar_api_run('b2000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini","n8nIssuedCall":0}',6)).id; select 'FIRST_RESERVED'; select pg_sleep(2); commit;`,database,text=>{if(text.includes('FIRST_RESERVED'))unlockReady();});
  await Promise.race([ready,first.then(result=>{throw Error(`First reservation ended unexpectedly: ${result.stderr}`);})]);
  const second=execute(`set application_name='radar-budget-contender'; select (public.reserve_radar_api_run('b2000000-0000-0000-0000-000000000002','{"model":"gpt-5-mini","n8nIssuedCall":0}',6)).id;`,database);
  await new Promise(resolve=>setTimeout(resolve,250));
  const locks=await checked(`select count(*) from pg_stat_activity where datname='${database}' and application_name='radar-budget-contender' and wait_event_type='Lock';`);
  assert.equal(locks.trim(),'1','Second independent session must wait on the first reservation lock.');
  const [a,b]=await Promise.all([first,second]); assert.equal(a.code,0,a.stderr); assert.notEqual(b.code,0,'Second session unexpectedly reserved a run.');
  assert.match(b.stderr,/Radar ya tiene una corrida activa|Límite de corridas autorizadas/);
  const result=await checked(`select json_build_object('entries',(select count(*) from private.radar_budget_entries where not legacy),'newRuns',(select new_runs_reserved from private.radar_budget_accounts),'spent',(select sum(spent_usd) from private.radar_budget_entries),'held',(select sum(held_usd) from private.radar_budget_entries),'legacy',(select reserved_usd from private.radar_api_pilot_usage));`);
  const receipt=JSON.parse(result.trim()); assert.equal(receipt.entries,1);assert.equal(receipt.newRuns,1);assert.equal(receipt.legacy,9);assert.equal(receipt.held,1.5);assert.ok(receipt.spent+receipt.held<=5);
  console.log('Real PostgreSQL two-session concurrency PASS',JSON.stringify(receipt));
} finally { if(created) await checked(`drop database ${database} with (force);`,null); }
