import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({client:{} as Record<string,unknown>,prepare:vi.fn(),pkg:vi.fn()}));
vi.mock("@/lib/supabase-server",()=>({getSupabaseAdminClient:()=>mocks.client}));
vi.mock("@/lib/radar-workspace",()=>({loadRadarResearchCorpus:async()=>[]}));
vi.mock("@/lib/radar-api-provider",async()=>({...await vi.importActual("@/lib/radar-api-provider"),radarApiConfiguration:()=>({enabled:true,workspaceId:"pilot",maxRuns:3,model:"gpt-5-mini"})}));
import { handleRadarN8n, authenticateRadarN8n } from "@/lib/radar-n8n-store";
import { advanceRadarN8n, decideRadarN8n, type RadarN8nState, type RadarGates } from "@/lib/radar-n8n-editorial";
import { POST } from "@/app/api/radar/runs/[runId]/n8n/route";
import { writer, review, response } from "./helpers/radar-n8n-fixtures";
let row:Record<string,any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let writes:number;let reservations:number;let race=false;
const runId="c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4";
beforeEach(()=>{
 writes=0;reservations=0;race=false;
 row={id:runId,created_at:"2026-09-16T12:00:00Z",workspace_id:"pilot",status:"dispatching",api_context:{engine:"radar_api_v1"},api_deadline_at:new Date(Date.now()+240000).toISOString(),request_kind:"opportunity_search",request_payload:{}};
 mocks.client={from:()=>{
  let patch:Record<string,unknown>|undefined;const conditions:Array<[string,unknown]>=[];let deadline="";
  const get=(key:string)=>key.includes("->>")?String(row[key.split("->>")[0]][key.split("->>")[1]]):row[key];
  const execute=()=>{if(patch&&race)row.status="canceled";const matches=conditions.every(([key,value])=>get(key)===value)&&(!deadline||row.api_deadline_at>deadline);if(patch&&matches){Object.assign(row,patch);writes++;}return {data:matches?structuredClone(row):null,error:null};};
  const q={select:()=>q,update:(v:Record<string,unknown>)=>{patch=v;return q;},eq:(k:string,v:unknown)=>{conditions.push([k,v]);return q;},gt:(_k:string,v:string)=>{deadline=v;return q;},maybeSingle:async()=>execute()};return q;
 },rpc:async(name:string,args:Record<string,unknown>)=>{
  if(name==="reserve_radar_api_run"){if(row.status!=="dispatching")return{data:null,error:null};reservations++;row.status="running";row.api_context={...(args.requested_context as object),engine:"radar_api_v1",preferences:{topics:["CRM & Ventas"]}};row.api_usage={reserved:true,reservedUsd:1.5,pilotReservedUsd:1.5};return{data:structuredClone(row),error:null};}
  if(name==="finish_radar_n8n_run"){if(row.status!=="running")return{data:null,error:null};row.status=args.requested_status;row.candidate=args.requested_candidate;row.api_context=args.requested_context;row.api_usage={...row.api_usage,...(args.requested_usage as object)};const receipt={ok:true,decision:row.api_context.decision,usage:row.api_usage,controlledPublication:true};row.api_context.n8nReceipt=receipt;return{data:receipt,error:null};}
  if(name==="finish_radar_api_run"){if(row.status!=="running")return{data:false,error:null};row.status=args.requested_status;return{data:true,error:null};}throw Error(name);
 }};
});
describe("Portal n8n durable ownership",()=>{
 it.each([['NO_PUBLICATION',null],['REJECT',0],['READY_FOR_REVIEW',2],['AUTO_PUBLISH',3]] as const)("persists controlled %s through the complete callback protocol",async(outcome,level)=>{
  let state=await handleRadarN8n(runId,"claim",{executionId:"one"}) as RadarN8nState;
  const outputs=level===null?[{outcome:"NO_PUBLICATION",candidate:null,reason:"Sin novedad suficiente."}]:[writer(),review(level,level===0?"REJECT":"PASS")];
  for(const output of outputs){state=await advanceRadarN8n(state);state=await handleRadarN8n(runId,"checkpoint",{executionId:"one",state}) as RadarN8nState;state.responses.push(response(output));}
  state=await advanceRadarN8n(state);
  const prepared=await handleRadarN8n(runId,"prepare",{executionId:"one",state}) as {state:RadarN8nState;gates:RadarGates;bands:{review:number;automatic:number}};
  const decision=decideRadarN8n(prepared.state,prepared.gates,prepared.bands);expect(decision.outcome).toBe(outcome);
  const receipt=await handleRadarN8n(runId,"finish",{executionId:"one",state,decision});expect(receipt.decision.outcome).toBe(outcome);
  expect(row.api_usage.reservedUsd).toBe(1.5);expect(row.api_usage.responseIds).toHaveLength(outputs.length);
  if(outcome==='REJECT')expect(row.candidate.score).toBe(0);
  expect(await handleRadarN8n(runId,"finish",{executionId:"one",state,decision})).toEqual(receipt);
 });

 it("claims once and rejects a duplicate execution before spend",async()=>{await handleRadarN8n(runId,"claim",{executionId:"one"});await expect(handleRadarN8n(runId,"claim",{executionId:"two"})).rejects.toThrow();expect(reservations).toBe(1);});
 it("authorizes each billable request once and keeps dollar reservation",async()=>{const initial=await handleRadarN8n(runId,"claim",{executionId:"one"});const state=await advanceRadarN8n(initial as Parameters<typeof advanceRadarN8n>[0]);await handleRadarN8n(runId,"checkpoint",{executionId:"one",state});expect(row.api_usage).toMatchObject({reservedUsd:1.5,calls:1});await expect(handleRadarN8n(runId,"checkpoint",{executionId:"one",state})).rejects.toThrow();expect(writes).toBe(1);});
 it("rejects execution-id substitution and does not replace context with caller data",async()=>{const state=await handleRadarN8n(runId,"claim",{executionId:"one"});await expect(handleRadarN8n(runId,"checkpoint",{executionId:"two",state})).rejects.toThrow();expect(writes).toBe(0);});
 it("cancellation racing with checkpoint wins",async()=>{const state=await handleRadarN8n(runId,"claim",{executionId:"one"});race=true;await expect(handleRadarN8n(runId,"checkpoint",{executionId:"one",state})).rejects.toThrow();expect(row.status).toBe("canceled");expect(writes).toBe(0);});
 it("rejects timeout before another provider call",async()=>{const state=await handleRadarN8n(runId,"claim",{executionId:"one"});row.api_deadline_at="2020-01-01";await expect(handleRadarN8n(runId,"checkpoint",{executionId:"one",state})).rejects.toThrow();expect(writes).toBe(0);});
 it("requires a distinct secure callback credential",()=>{vi.stubEnv("RADAR_N8N_CALLBACK_SECRET","c".repeat(32));expect(authenticateRadarN8n(null)).toBe(false);expect(authenticateRadarN8n("wrong")).toBe(false);expect(authenticateRadarN8n("c".repeat(32))).toBe(true);expect(authenticateRadarN8n(`  ${"c".repeat(32)}  `)).toBe(true);vi.unstubAllEnvs();});
 it("unauthenticated callback cannot read or mutate a run",async()=>{const res=await POST(new Request("https://portal.example/api",{method:"POST",body:"{}"}),{params:Promise.resolve({runId})});expect(res.status).toBe(401);expect(writes).toBe(0);});
 it("oversized callback is bounded before JSON parse",async()=>{vi.stubEnv("RADAR_N8N_CALLBACK_SECRET","c".repeat(32));const res=await POST(new Request("https://portal.example/api",{method:"POST",headers:{"x-radar-callback-secret":"c".repeat(32)},body:"x".repeat(1000001)}),{params:Promise.resolve({runId})});expect(res.status).toBe(413);vi.unstubAllEnvs();});
});
