import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { advanceRadarN8n, decideRadarN8n, editorialGates, sanitizeRadarResponse, RADAR_CRITICAL_GATES, RADAR_SCORE_CRITERIA, type RadarGates } from "@/lib/radar-n8n-editorial";
import { writer, discovery, review, response, initial } from "./helpers/radar-n8n-fixtures";
const gates=():RadarGates=>Object.fromEntries(RADAR_CRITICAL_GATES.map(key=>[key,true])) as RadarGates;
async function completed(outputs:unknown[]){let state=initial();for(const output of outputs){state=await advanceRadarN8n(state);expect(state.request).toBeTruthy();state.responses.push(response(output));}return advanceRadarN8n(state);}
const metaCorpusPublication={slug:"meta-business-agent-whatsapp-leads-ventas",title:"Meta Business Agent: qué cambia cuando WhatsApp empieza a calificar leads y cerrar ventas",topicFingerprint:"actualidad:crm-automatizacion-comercial:meta-business-agent-whatsapp-leads-ventas",sources:[{name:"Meta Newsroom",url:"https://about.fb.com/news/2026/06/meta-business-agent/"}],url:"https://www.nexopstech.com/noticias/meta-business-agent-whatsapp-leads-ventas"};
const microsoftSource={name:"Microsoft Power Platform Blog",url:"https://www.microsoft.com/en-us/power-platform/blog/power-apps/whats-new-in-power-platform-september-2026-feature-update/",evidence:"Microsoft documentó la búsqueda del lado del servidor en My Flows el 17 de septiembre de 2026."};
const microsoftSupportingSource={name:"Microsoft Learn",url:"https://learn.microsoft.com/en-us/power-automate/find-saved-cloud-flow",evidence:"La documentación explica cómo encontrar flujos guardados y el alcance de la búsqueda."};
const microsoftClaim={text:"My Flows incorporó búsqueda del lado del servidor.",sourceUrls:[microsoftSource.url,microsoftSupportingSource.url]};
function replayResponse(output:unknown,sources:Record<string,unknown>[],type:"search"|"open_page"="search"){
 return sanitizeRadarResponse({status:"completed",id:"resp_replay",usage:{input_tokens:100,output_tokens:200},output:[{type:"web_search_call",status:"completed",action:{type,url:type==="open_page"?sources[0]?.url:undefined,sources:type==="search"?sources:[]}},{type:"message",content:[{type:"output_text",text:JSON.stringify(output)}]}]});
}
function microsoftWriter(){const output=writer();output.candidate={...output.candidate,title:"Power Automate acelera la búsqueda completa en My Flows",sourceName:microsoftSource.name,sourceUrl:microsoftSource.url,draft:{...output.candidate.draft,headline:"Power Automate acelera la búsqueda completa en My Flows"}};output.sources=[microsoftSource,microsoftSupportingSource];output.claims=[microsoftClaim];output.topicIdentity="Power Automate + búsqueda del lado del servidor en My Flows + 2026-09-17";return output;}
describe("n8n bounded editorial state and gate-aware scoring",()=>{
 it("replays n8n31268 as the same real Meta duplicate after one discovery response",async()=>{
  let state=initial(); state.context.requestKind="opportunity_search"; state.context.requestPayload={}; state.context.corpus=[metaCorpusPublication]; state=await advanceRadarN8n(state); expect(state.request).toBeTruthy();
  const output=discovery(); output.candidates=[{...output.candidates[0],title:"Meta Business Agent ya está disponible",sourceName:"Meta Newsroom",sourceUrl:"https://about.fb.com/news/2026/06/meta-business-agent/",topicIdentity:"Meta Business Agent — lanzamiento global — 2026-06-03"}];
  state.responses.push(replayResponse(output,[{name:"Meta Newsroom",url:output.candidates[0].sourceUrl,evidence:"Meta anunció disponibilidad global el 3 de junio de 2026."}])); state=await advanceRadarN8n(state);
  expect(state.result?.status).toBe("no_publication"); expect(state.checkpoint?.usage.calls).toBe(1); expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"NO_PUBLICATION",score:null});
 });
 it("deduplicates a manual source before the provider when only tracking, fragment and trailing slash differ",async()=>{
  const state=initial(); state.context.corpus=[metaCorpusPublication]; state.context.requestKind="manual_note"; state.context.requestPayload={sourceUrl:"https://about.fb.com/news/2026/06/meta-business-agent/?utm_source=radar&fbclid=x#detalle"};
  const next=await advanceRadarN8n(state); expect(next.request).toBeUndefined(); expect(next.result?.status).toBe("no_publication"); expect(next.result?.usage.calls).toBe(0); expect(next.checkpoint?.phase).toBe("prefilter_duplicate");
 });
 it("does not collapse a semantically distinct query while prefiltering a new source",async()=>{
  const state=initial(); state.context.corpus=[{...metaCorpusPublication,sources:[{name:"Vendor",url:"https://vendor.example/release?edition=standard"}]}]; state.context.requestKind="manual_note"; state.context.requestPayload={sourceUrl:"https://vendor.example/release?edition=pro"};
  const next=await advanceRadarN8n(state); expect(next.request).toBeTruthy(); expect(next.result).toBeUndefined(); expect(next.checkpoint?.usage.calls).toBe(1);
 });
 it("replays n8n31419 without accepting the false duplicate and carries first-pass evidence through FIX",async()=>{
  let state=initial(); state.context.corpus=[metaCorpusPublication];
  state=await advanceRadarN8n(state); state.responses.push(replayResponse(microsoftWriter(),[microsoftSource,microsoftSupportingSource])); state=await advanceRadarN8n(state);
  const falseDuplicate=review(2,"FIX"); falseDuplicate.sources=[microsoftSource]; falseDuplicate.checkedClaims=[{...microsoftClaim,supported:true}]; falseDuplicate.criticalGates.novelty=false; falseDuplicate.criticalGateReasons.novelty="La URL ya estaba en el corpus."; falseDuplicate.duplicateMatch=null;
  state.responses.push(replayResponse(falseDuplicate,[microsoftSource],"open_page")); state=await advanceRadarN8n(state);
  expect(state.error).toBeUndefined(); expect(state.request).toBeTruthy(); expect(state.checkpoint?.candidate?.qa?.verdict).toBe("FIX"); expect(state.checkpoint?.candidate?.qa?.reason).toContain("QA inconsistente");
  state.responses.push(replayResponse(microsoftWriter(),[microsoftSource],"open_page")); state=await advanceRadarN8n(state);
  expect(state.error).toBeUndefined(); expect(state.request).toBeTruthy(); expect(state.checkpoint?.sources.map(source=>source.url)).toContain(microsoftSupportingSource.url);
  const passingReview=review(2,"PASS"); passingReview.sources=[microsoftSource]; passingReview.checkedClaims=[{...microsoftClaim,supported:true}];
  for(const criterion of RADAR_SCORE_CRITERIA) passingReview.rubric[criterion]={level:2,evidence:microsoftSource.evidence,sourceUrls:[microsoftSource.url]};
  state.responses.push(replayResponse(passingReview,[microsoftSource],"open_page")); state=await advanceRadarN8n(state);
  expect(state.result?.status).toBe("review_pending"); expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"READY_FOR_REVIEW",eligibility:"ELIGIBLE"});
 });
 it("rejects a novelty failure whose concrete publication reference does not exist",async()=>{
  const report=review(2,"REJECT"); report.criticalGates.novelty=false; report.criticalGateReasons.novelty="Coincide con una publicación indicada."; report.duplicateMatch={matchedPublicationId:"missing",matchedPublicationUrl:"https://www.nexopstech.com/noticias/inexistente",matchedPublicationTitle:"Inexistente",matchedTopicFingerprint:null,reason:"Supuesto duplicado"};
  let state=initial(); state.context.corpus=[metaCorpusPublication]; state=await advanceRadarN8n(state); state.responses.push(response(writer())); state=await advanceRadarN8n(state); state.responses.push(response(report)); state=await advanceRadarN8n(state);
  expect(state.error).toBeUndefined(); expect(state.request).toBeTruthy(); expect(state.checkpoint?.candidate?.qa).toMatchObject({verdict:"FIX"}); expect(state.checkpoint?.candidate?.qa?.reason).toContain("referencia válida"); expect(editorialGates(state).novelty).toBe(true);
 });
 it("accepts a demonstrated duplicate only when every reference resolves to one real corpus entry",async()=>{
  const report=review(2,"REJECT"); report.criticalGates.novelty=false; report.criticalGateReasons.novelty="La oportunidad repite la publicación identificada."; report.duplicateMatch={matchedPublicationId:metaCorpusPublication.slug,matchedPublicationUrl:metaCorpusPublication.url,matchedPublicationTitle:metaCorpusPublication.title,matchedTopicFingerprint:metaCorpusPublication.topicFingerprint,reason:"Mismo acontecimiento ya cubierto."};
  let state=initial(); state.context.corpus=[metaCorpusPublication]; state=await advanceRadarN8n(state); state.responses.push(response(writer())); state=await advanceRadarN8n(state); state.responses.push(response(report)); state=await advanceRadarN8n(state);
  expect(state.result?.status).toBe("rejected"); expect(state.result?.reason).toContain("novelty:"); expect(editorialGates(state).novelty).toBe(false); expect(decideRadarN8n(state,gates())).toMatchObject({outcome:"REJECT",score:null,failedGates:["novelty"]});
 });
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
  const state=initial(); state.context.requestPayload={}; state.responses.push(sanitizeRadarResponse(raw)); const next=await advanceRadarN8n(state);
  expect(next.error).toContain("evidencia verificable"); expect(next.checkpoint?.sources).toEqual([]); expect(decideRadarN8n(next,gates()).score).toBeNull();
 });
 it("does not admit sources from a failed search into the evidence ledger",async()=>{
  const raw=response(writer()); (raw.output as Record<string,unknown>[])[0]={type:"web_search_call",status:"failed",action:{type:"search",sources:[{name:"Untrusted",url:"https://untrusted.example/fake"}]}};
  const state=initial(); state.context.requestPayload={}; state.responses.push(sanitizeRadarResponse(raw)); const next=await advanceRadarN8n(state);
  expect(next.error).toContain("evidencia verificable"); expect(next.checkpoint?.sources).toEqual([]);
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
