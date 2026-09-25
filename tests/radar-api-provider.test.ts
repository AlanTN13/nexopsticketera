import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executeRadarEditorial, parseRadarApiResponse, radarApiConfiguration, type RadarApiCheckpoint, type RadarApiContext } from "@/lib/radar-api-provider";
const source = { name: "Documentación oficial", url: "https://vendor.example/release", evidence: "El producto permite exportar datos desde septiembre de 2026." };
const claim = { text: "La versión permite exportar datos.", sourceUrls: [source.url] };
const draft = { headline: "La nueva versión permite exportar datos", deck: "Una actualización orientada a reducir el trabajo manual de los equipos comerciales.", bodyMarkdown: "## Qué cambia\n\n" + "La actualización facilita la exportación de datos para revisión por el equipo. ".repeat(12) };
const candidate = { title: draft.headline, topic: "CRM & Ventas", sourceName: source.name, sourceUrl: source.url, score: 85, businessReasons: ["Reduce tareas manuales de seguimiento."], draft };
const writer = () => ({ outcome: "CANDIDATE", reason: "Aporte empresarial", candidate, sources: [source], claims: [claim], topicIdentity: "Vendor exportación septiembre 2026" });
const review = (verdict = "PASS") => ({ verdict, reason: verdict === "FIX" ? "Aclarar límites de disponibilidad." : "La fuente respalda la afirmación.", sources: [source], checkedClaims: [{ ...claim, supported: true }], duplicateMatch: null, criticalGates: {sources:true,facts:true,novelty:true,clientClaims:true,content:true}, criticalGateReasons: {sources:"",facts:"",novelty:"",clientClaims:"",content:""} });
function response(output: unknown, sources = [source]) { return { status: "completed", id: "resp_test", usage: { input_tokens: 100, output_tokens: 200 }, output: [{ type: "web_search_call", status: "completed", action: { type: "search", sources } }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] }; }
async function run(outputs: unknown[], options: { active?: () => Promise<void>; signal?: AbortSignal; status?: number; context?: Partial<RadarApiContext>; responseSources?: typeof source[] } = {}) {
  const checkpoints: RadarApiCheckpoint[] = [];
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(response(outputs.shift(), options.responseSources)), { status: options.status ?? 200 }));
  const result = executeRadarEditorial({ context: { preferences: { topics: ["CRM & Ventas"] }, corpus: [], requestKind: "manual_note", requestPayload: {sourceUrl:source.url}, requestedAt: "2026-09-15T12:00:00Z", model: "gpt-5-mini", ...options.context }, apiKey: "test-only-not-a-real-key", signal: options.signal ?? new AbortController().signal, fetchImpl: fetchImpl as typeof fetch,
    checkpoint: async value => { checkpoints.push(structuredClone(value)); }, assertActive: options.active ?? (async () => {}) });
  return { result, checkpoints, fetchImpl };
}
afterEach(() => vi.unstubAllEnvs());
describe("Radar API editorial contract", () => {
  const metaSource = {name:"Meta Newsroom",url:"https://about.fb.com/news/2026/06/meta-business-agent/",evidence:"Meta anunció Business Agent en junio de 2026."};
  const metaPublication = {slug:"meta-business-agent-whatsapp-leads-ventas",title:"Meta Business Agent: qué cambia cuando WhatsApp empieza a calificar leads y cerrar ventas",sources:[metaSource]};
  const metaProposal = {title:"Meta Business Agent",topic:"CRM & Ventas",sourceName:metaSource.name,sourceUrl:metaSource.url,businessReasons:["Automatiza atención comercial."],topicIdentity:"Meta Business Agent — lanzamiento global — 2026-06-03"};
  const newProposal = {title:candidate.title,topic:candidate.topic,sourceName:source.name,sourceUrl:source.url,businessReasons:candidate.businessReasons,topicIdentity:writer().topicIdentity};
  const discovery = (...candidates:typeof metaProposal[]) => ({outcome:"CANDIDATES",reason:"Fuentes recientes contrastadas.",candidates});
  it("replays e42e and f2c: discards Meta, selects a new source, then drafts and reviews",async()=>{
    const test=await run([discovery(metaProposal,newProposal),writer(),review()],{context:{requestKind:"opportunity_search",requestPayload:{},corpus:[metaPublication]},responseSources:[metaSource,source]});
    const result=await test.result;expect(result.status).toBe("review_pending");expect(result.usage.calls).toBe(3);
    const selection=test.checkpoints.find(point=>point.phase==="discovery_selected");
    expect(selection?.candidate).toBeNull();expect(selection?.discardedCandidates).toMatchObject([{sourceUrl:metaSource.url,reason:`Corpus: ${metaPublication.slug}`}]);
    expect(test.checkpoints.find(point=>point.phase==="draft_ready")?.usage.calls).toBe(2);
    const requests=(test.fetchImpl.mock.calls as unknown as Array<[unknown,RequestInit]>).map(call=>JSON.parse(String(call[1].body)));
    expect(requests.map(request=>request.text.format.name)).toEqual(["radar_discovery_v1","radar_writer_v1","radar_review_v1"]);
    expect(JSON.stringify(requests[0].text.format.schema)).not.toContain("bodyMarkdown");
    expect(requests[1].input).toContain(source.url);
  });
  it("ends NO_PUBLICATION only after every bounded discovery candidate is a proven duplicate",async()=>{
    const tracked={...metaProposal,sourceUrl:`${metaSource.url}?utm_source=radar#top`};
    const test=await run([discovery(metaProposal,tracked)],{context:{requestKind:"opportunity_search",requestPayload:{},corpus:[metaPublication]},responseSources:[metaSource]});
    expect((await test.result).status).toBe("no_publication");expect(test.fetchImpl).toHaveBeenCalledTimes(1);
    expect(test.checkpoints.at(-1)?.discardedCandidates).toHaveLength(2);
  });
  it("avoids a recently discarded duplicate and bounds the batch without another provider call",async()=>{
    const test=await run([discovery(metaProposal,newProposal),writer(),review()],{context:{requestKind:"opportunity_search",requestPayload:{},recentDuplicates:[{sourceUrl:metaSource.url}]},responseSources:[metaSource,source]});
    expect((await test.result).status).toBe("review_pending");expect(test.checkpoints.find(point=>point.phase==="discovery_selected")?.discardedCandidates).toHaveLength(1);
    const tooMany=await run([discovery(newProposal,newProposal,newProposal,newProposal)],{context:{requestKind:"opportunity_search",requestPayload:{}},responseSources:[source]});
    await expect(tooMany.result).rejects.toThrow("lista acotada");expect(tooMany.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("keeps FIX and independent re-review within five calls and the existing monetary cap",async()=>{
    const test=await run([discovery(newProposal),writer(),review("FIX"),writer(),review()],{context:{requestKind:"opportunity_search",requestPayload:{}}});
    expect((await test.result).status).toBe("review_pending");expect(test.fetchImpl).toHaveBeenCalledTimes(5);
    const requests=(test.fetchImpl.mock.calls as unknown as Array<[unknown,RequestInit]>).map(call=>JSON.parse(String(call[1].body)));
    expect(requests.map(request=>request.text.format.name)).toEqual(["radar_discovery_v1","radar_writer_v1","radar_review_v1","radar_writer_v1","radar_review_v1"]);
  });
  it("requires a private n8n webhook, pilot workspace and bounded usage; expensive model cannot activate", () => {
    vi.stubEnv("RADAR_API_ENABLED", "true"); vi.stubEnv("RADAR_N8N_WEBHOOK_URL", "https://automation.example/webhook/radar"); vi.stubEnv("RADAR_N8N_DISPATCH_SECRET", "d".repeat(32)); vi.stubEnv("RADAR_N8N_CALLBACK_SECRET", "c".repeat(32)); vi.stubEnv("RADAR_API_PILOT_WORKSPACE_ID", "nexops"); vi.stubEnv("RADAR_API_PILOT_MAX_RUNS", "3");
    expect(radarApiConfiguration().enabled).toBe(true);
    vi.stubEnv("RADAR_OPENAI_MODEL", "gpt-6-astra"); expect(radarApiConfiguration().enabled).toBe(false);
  });
  it("researches one candidate and independently reviews with evidence in two calls", async () => {
    const test = await run([writer(), review()]); const result = await test.result;
    expect(result.status).toBe("review_pending"); expect(result.candidate?.qa?.verdict).toBe("PASS"); expect(test.fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.sources).toEqual([source]); expect(result.usage.calls).toBe(2);
    expect(test.checkpoints.some(point => point.phase === "draft_ready" && point.candidate?.draft)).toBe(true);
    const request = JSON.parse(String((test.fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit]>)[1][1].body));
    expect(request.input).toContain(source.evidence); expect(request.max_tool_calls).toBe(2); expect(request.store).toBe(false);
  });
  it("terminates NO_PUBLICATION without drafting or reviewing", async () => {
    const test = await run([{ outcome: "NO_PUBLICATION", candidate: null, reason: "No hay novedad suficiente." }]);
    expect((await test.result).status).toBe("no_publication"); expect(test.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("stops a deterministic manual duplicate before the provider", async () => {
    const checkpoints: RadarApiCheckpoint[] = [];
    const fetchImpl = vi.fn();
    const result = await executeRadarEditorial({ context: { preferences: {}, corpus: [{ slug: "published", title: "Nota publicada", sources: [{ url: "https://vendor.example/release" }] }], requestKind: "manual_note", requestPayload: { sourceUrl: "https://vendor.example/release/?utm_campaign=radar#top" }, requestedAt: "2026-09-22", model: "gpt-5-mini" }, signal: new AbortController().signal, fetchImpl: fetchImpl as typeof fetch, checkpoint: async value => { checkpoints.push(value); }, assertActive: async()=>{} });
    expect(result).toMatchObject({status:"no_publication",usage:{calls:0}}); expect(fetchImpl).not.toHaveBeenCalled(); expect(checkpoints.at(-1)?.phase).toBe("prefilter_duplicate");
  });
  it("allows one FIX and a fresh review, never a second repair", async () => {
    const test = await run([writer(), review("FIX"), writer(), review("FIX")]);
    const result = await test.result; expect(result.status).toBe("rejected"); expect(result.reason).toContain("única corrección"); expect(test.fetchImpl).toHaveBeenCalledTimes(4);
  });
  it("returns PASS after correction and re-review", async () => {
    const test = await run([writer(), review("FIX"), writer(), review()]); expect((await test.result).status).toBe("review_pending"); expect(test.fetchImpl).toHaveBeenCalledTimes(4);
  });
  it("rejects invented writer sources even if score is high", async () => {
    const output = writer(); output.sources = [{ ...source, url: "https://invented.example/fake" }];
    const test = await run([output]); expect((await test.result).status).toBe("rejected"); expect(test.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("rejects a PASS without claim-by-claim support", async () => {
    const output = review(); output.checkedClaims = [];
    const test = await run([writer(), output]); expect((await test.result).status).toBe("rejected");
  });
  it("constrains writer, QA and the one correction with strict root schemas while preserving web search", async () => {
    const test = await run([writer(), review("FIX"), writer(), review()]); await test.result;
    const requests = (test.fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit]>).map(call => JSON.parse(String(call[1].body)));
    expect(requests.map(request => request.text.format.name)).toEqual(["radar_writer_v1", "radar_review_v1", "radar_writer_v1", "radar_review_v1"]);
    for (const request of requests) {
      expect(request.text.format).toMatchObject({ type: "json_schema", strict: true, schema: { type: "object", additionalProperties: false } });
      expect(request.tools).toEqual([{ type: "web_search", search_context_size: "low" }]);
      expect(request.tool_choice).toBe("required"); expect(request.model).toBe("gpt-5-mini");
    }
    const schema = requests[0].text.format.schema;
    expect(schema.required).toEqual(["outcome", "reason", "candidate", "sources", "claims", "topicIdentity"]);
    expect(schema.properties.candidate.anyOf[0].properties.sources).toBeUndefined();
    expect(schema.properties.candidate.anyOf[1]).toEqual({ type: "null" });
    expect(schema.properties.sources.items.properties.publishedAt.type).toEqual(["string", "null"]);
    expect(requests[1].text.format.schema.required).toContain("criticalGates");
    expect(requests[1].text.format.schema.required).toContain("duplicateMatch");
    expect(requests[1].text.format.schema.required).toContain("rubric");
  });
  it("provider errors fail without exposing response body or pretending NO_PUBLICATION", async () => {
    const test = await run([{ secret: "must-not-surface" }], { status: 429 }); await expect(test.result).rejects.toThrow("OpenAI rechazó la solicitud (429)"); expect(test.checkpoints[0].usage.calls).toBe(1);
  });
  it("cancellation before review prevents another request", async () => {
    let checks = 0; const test = await run([writer(), review()], { active: async () => { if (++checks === 3) throw new Error("Canceled"); } });
    await expect(test.result).rejects.toThrow("Canceled"); expect(test.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("aborted deadline prevents API consumption", async () => {
    const signal = AbortSignal.abort(); const test = await run([writer()], { signal }); await expect(test.result).rejects.toThrow(); expect(test.fetchImpl).not.toHaveBeenCalled();
  });
  it.each(["completed", "incomplete"])("preserves safe evidence and usage when %s response has invalid editorial JSON", async status => {
    const checkpoints: RadarApiCheckpoint[] = [];
    const broken = response(null);
    broken.status = status;
    broken.output[1].content![0].text = "invalid-json-private-text";
    await expect(executeRadarEditorial({
      context: { preferences: {}, corpus: [], requestKind: "opportunity_search", requestPayload: {}, requestedAt: "2026-09-15", model: "gpt-5-mini" },
      apiKey: "test-only", signal: new AbortController().signal,
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(broken))) as typeof fetch,
      checkpoint: async value => { checkpoints.push(structuredClone(value)); }, assertActive: async () => {},
    })).rejects.toThrow(status === "completed" ? "inválido" : "no completó");
    const saved = checkpoints.at(-1)!;
    expect(saved.sources).toEqual([source]);
    expect(saved.usage).toMatchObject({ calls: 1, webSearchCalls: 1, inputTokens: 100, outputTokens: 200 });
    expect(saved.usage.estimatedUsd).toBeGreaterThan(0.01);
    expect(JSON.stringify(checkpoints)).not.toContain("invalid-json-private-text");
  });
  it("retains all consulted URLs, not just inline primary citations; excludes reasoning", () => {
    const parsed = parseRadarApiResponse(response({ outcome: "NO_PUBLICATION" }, [source, { name: "Otra", url: "https://other.example/news", evidence: "otra" }])); expect(parsed.sources).toHaveLength(2);
    expect(() => parseRadarApiResponse({ status: "incomplete" })).toThrow("no completó");
  });
});
