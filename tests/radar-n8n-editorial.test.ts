import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { advanceRadarN8n, decideRadarN8n, editorialGates, sanitizeRadarResponse, RADAR_CRITICAL_GATES, RADAR_SCORE_CRITERIA, type RadarGates } from "@/lib/radar-n8n-editorial";
import { writer, review, response, initial } from "./helpers/radar-n8n-fixtures";
const gates=():RadarGates=>Object.fromEntries(RADAR_CRITICAL_GATES.map(key=>[key,true])) as RadarGates;
async function completed(outputs:unknown[]){let state=initial();for(const output of outputs){state=await advanceRadarN8n(state);expect(state.request).toBeTruthy();state.responses.push(response(output));}return advanceRadarN8n(state);}
describe("n8n bounded editorial state and gate-aware scoring",()=>{
 it.each(["open_page","find_in_page"])("preserves completed %s provider URLs through repeated sanitization and QA",async type=>{
  const output=writer(); const url=output.candidate.sourceUrl; let state=initial();
  for(const content of [output,review(2)]){
   const raw=response(content); (raw.output as Record<string,unknown>[])[0]={type:"web_search_call",status:"completed",action:{type,url,pattern:"PRIVATE_PATTERN",query:"PRIVATE_QUERY"}};
   const safe=sanitizeRadarResponse(raw); expect(sanitizeRadarResponse(safe)).toEqual(safe); expect(JSON.stringify(safe)).not.toContain("PRIVATE_");
   state.responses.push(safe); state=await advanceRadarN8n(state);
  }
  expect(state.error).toBeUndefined(); expect(state.result?.candidate?.qa?.verdict).toBe("PASS");
  expect(state.result?.sources.some(source=>source.url===url)).toBe(true);
  expect(decideRadarN8n(state,gates()).outcome).toBe("READY_FOR_REVIEW");
 });
 it.each([
  {type:"open_page",status:"failed",url:"https://vendor.example/release"},
  {type:"open_page",status:"incomplete",url:"https://vendor.example/release"},
  {type:"open_page",status:undefined,url:"https://vendor.example/release"},
  {type:"open_page",status:"completed",url:null},
  {type:"open_page",status:"completed",url:"https://127.0.0.1/private"},
  {type:"unknown",status:"completed",url:"https://vendor.example/release"},
 ])("never invents evidence for an invalid page action %j",async action=>{
  const raw=response(writer()); (raw.output as Record<string,unknown>[])[0]={type:"web_search_call",status:action.status,action:{type:action.type,url:action.url}};
  const state=initial(); state.responses.push(sanitizeRadarResponse(raw)); const next=await advanceRadarN8n(state);
  expect(next.error).toContain("evidencia verificable"); expect(next.checkpoint?.sources).toEqual([]); expect(decideRadarN8n(next,gates()).score).toBeNull();
 });
 it("produces native OpenAI request without credentials or provider network access",async()=>{const state=await advanceRadarN8n(initial());expect(state.request).toMatchObject({model:"gpt-5-mini",store:false,max_tool_calls:2});expect(JSON.stringify(state)).not.toContain("Bearer");expect(state.checkpoint?.usage.calls).toBe(1);});
 it("NO_PUBLICATION is an honest terminal outcome",async()=>{const state=await completed([{outcome:"NO_PUBLICATION",candidate:null,reason:"No existe una novedad verificable."}]);expect(decideRadarN8n(state,gates()).outcome).toBe("NO_PUBLICATION");expect(state.checkpoint?.usage.calls).toBe(1);});
 it("returns READY_FOR_REVIEW at existing opportunity band",async()=>{const state=await completed([writer(),review(2)]);expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"READY_FOR_REVIEW",score:70,eligibility:"ELIGIBLE"});expect(state.result?.candidate?.score).toBe(0);});
 it("AUTO_PUBLISH eligibility requires every gate and the existing 85 band",async()=>{const state=await completed([writer(),review(3)]);expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"AUTO_PUBLISH",score:85});});
 it.each(RADAR_CRITICAL_GATES)("failed %s rejects before scoring",async gate=>{const state=await completed([writer(),review(4)]);expect(decideRadarN8n(state,{...gates(),[gate]:false})).toMatchObject({outcome:"REJECT",eligibility:"INELIGIBLE",score:null,failedGates:[gate]});});
 it("a 100 writer score never survives QA rejection",async()=>{const state=await completed([writer(),review(4,"REJECT")]);expect(state.result?.candidate?.score).toBe(0);expect(decideRadarN8n(state,gates()).score).toBeNull();});
 it("95 stays exceptional: one host cannot earn exceptional rubric components",async()=>{const state=await completed([writer(),review(4)]);expect(decideRadarN8n(state,gates()).score).toBe(85);});
 it("partial or invented rubric evidence earns no free points",async()=>{const report=review(4);for(const key of RADAR_SCORE_CRITERIA)report.rubric[key].sourceUrls=["https://invented.example/"];const state=await completed([writer(),report]);expect(decideRadarN8n(state,gates()).outcome).toBe("REJECT");});
 it("permits only one correction and re-review",async()=>{const state=await completed([writer(),review(2,"FIX"),writer(),review(2,"FIX")]);expect(state.request).toBeUndefined();expect(state.checkpoint?.usage.calls).toBe(4);expect(decideRadarN8n(state,gates()).outcome).toBe("REJECT");});
 it("FIX then fresh PASS can reach review",async()=>{const state=await completed([writer(),review(2,"FIX"),writer(),review(2)]);expect(decideRadarN8n(state,gates()).outcome).toBe("READY_FOR_REVIEW");});
 it.each(["concrete", "missing"])("rejects contradictory PASS with %s client-claim reason before cover preparation",async reason=>{
  const report=review(4); report.criticalGates.clientClaims=false;
  report.criticalGateReasons.clientClaims=reason==="concrete"?"La afirmación de resultados de un cliente no tiene autorización verificable.":"";
  const state=await completed([writer(),report]);
  expect(state.result?.status).toBe("rejected"); expect(state.result?.candidate?.qa?.verdict).toBe("REJECT");
  expect(state.result?.candidate?.qa?.reason).toContain("clientClaims:");
  expect(state.request).toBeUndefined(); expect(state.checkpoint?.usage.calls).toBe(2);
  expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"REJECT",eligibility:"INELIGIBLE",score:null,failedGates:["clientClaims"]});
 });
 it("missing critical flag cannot retain PASS",async()=>{
  const report=review(); Reflect.deleteProperty(report.criticalGates,"facts");
  const state=await completed([writer(),report]); expect(state.result?.candidate?.qa?.verdict).toBe("REJECT");
  expect(decideRadarN8n(state,gates())).toMatchObject({score:null,failedGates:["facts"]});
 });
 it("does not spend a correction on unexplained failed controls",async()=>{
  const report=review(2,"FIX"); report.criticalGates.facts=false;
  const state=await completed([writer(),report]); expect(state.request).toBeUndefined();
  expect(state.checkpoint?.usage.calls).toBe(2); expect(state.result?.candidate?.qa?.verdict).toBe("REJECT");
 });
 it("permits a justified FIX then exactly one corrected draft and fresh passing review",async()=>{
  const report=review(2,"FIX"); report.criticalGates.facts=false; report.criticalGateReasons.facts="Eliminar el porcentaje de ahorro que no aparece en la fuente consultada.";
  const state=await completed([writer(),report,writer(),review(2)]);
  expect(state.checkpoint?.usage.calls).toBe(4); expect(state.request).toBeUndefined();
  expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"READY_FOR_REVIEW",score:70});
 });
 it("does not invent failed controls when correction writer returns no publication",async()=>{
  const state=await completed([writer(),review(2,"FIX"),{outcome:"NO_PUBLICATION",candidate:null,reason:"La corrección no conserva una oportunidad verificable."}]);
  expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"REJECT",score:null,failedGates:[]});
 });
 it("expired runs cannot yield another billable request",async()=>{const state=await advanceRadarN8n({...initial(),deadline:"2020-01-01"});expect(state.request).toBeUndefined();expect(decideRadarN8n(state,gates()).outcome).toBe("FAILED");});
 it("does not convert transport error into NO_PUBLICATION or retain provider secrets",async()=>{const state=initial();state.responses.push(sanitizeRadarResponse({error:{message:"SECRET"}}));const next=await advanceRadarN8n(state);expect(decideRadarN8n(next,gates()).outcome).toBe("FAILED");expect(JSON.stringify(next)).not.toContain("SECRET");});
 it("uses configured bands and rejects malformed ones",async()=>{const state=await completed([writer(),review(3)]);expect(decideRadarN8n(state,gates(),{review:80,automatic:90}).outcome).toBe("READY_FOR_REVIEW");expect(decideRadarN8n(state,gates(),{review:90,automatic:80}).outcome).toBe("FAILED");});
 it("gates missing from reviewer are fail-closed",async()=>{const state=await completed([writer(),{...review(),criticalGates:{}}]);expect(Object.values(editorialGates(state)).every(value=>value===false)).toBe(true);});
 it("preserves real provider usage separately from reservation and excludes reasoning",async()=>{const state=await completed([writer(),review()]);expect(state.checkpoint?.usage).toMatchObject({calls:2,inputTokens:200,outputTokens:400,webSearchCalls:2});expect(state.checkpoint?.usage.estimatedUsd).toBeCloseTo(0.02085);expect(JSON.stringify(state)).not.toContain("must not persist");});
});
