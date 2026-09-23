// Provider-level shape constraints. Evidence, QA and publication gates still
// run independently; a well-shaped response is not an eligible article.
type Schema = Record<string, unknown>;
const text = { type: "string" };
const texts = { type: "array", items: text };
const object = (properties: Record<string, Schema>): Schema => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});
const array = (items: Schema): Schema => ({ type: "array", items });
const source = object({ name: text, url: text, evidence: text, publishedAt: { type: ["string", "null"] } });
const claim = object({ text, sourceUrls: texts });
const candidate = object({
  title: text, topic: text, sourceName: text, sourceUrl: text, businessReasons: texts,
  draft: object({ headline: text, deck: text, bodyMarkdown: text }),
});
const writer = object({
  outcome: { type: "string", enum: ["CANDIDATE", "NO_PUBLICATION"] }, reason: text,
  candidate: { anyOf: [candidate, { type: "null" }] },
  sources: array(source), claims: array(claim), topicIdentity: text,
});
const criterion = object({ level: { type: "integer", enum: [0, 1, 2, 3, 4] }, evidence: text, sourceUrls: texts });
const duplicateMatch = object({
  matchedPublicationId: text,
  matchedPublicationUrl: text,
  matchedPublicationTitle: text,
  matchedTopicFingerprint: { type: ["string", "null"] },
  reason: text,
});
const review = object({
  verdict: { type: "string", enum: ["PASS", "FIX", "REJECT"] }, reason: text,
  sources: array(source), checkedClaims: array(object({ text, supported: { type: "boolean" }, sourceUrls: texts })),
  duplicateMatch: { anyOf: [duplicateMatch, { type: "null" }] },
  criticalGates: object(Object.fromEntries(["sources", "facts", "novelty", "clientClaims", "content"].map(key => [key, { type: "boolean" }]))),
  criticalGateReasons: object(Object.fromEntries(["sources", "facts", "novelty", "clientClaims", "content"].map(key => [key, text]))),
  rubric: object(Object.fromEntries(["businessImpact", "novelty", "evidenceQuality", "actionability", "timeliness"].map(key => [key, criterion]))),
});

export function radarOutputFormat(phase: string) {
  const isReview = phase === "review" || phase === "review_after_fix";
  return { type: "json_schema", name: isReview ? "radar_review_v1" : "radar_writer_v1", strict: true, schema: isReview ? review : writer };
}
