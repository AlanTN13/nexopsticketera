import type { RadarApiUsage } from "@/lib/radar-api-provider";

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const counter = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Provider telemetry only. An authorized HTTP request is not evidence of billed usage. */
export function radarBudgetUsage(responses: Json[]): RadarApiUsage & { telemetryVersion: 2; telemetryComplete: boolean } {
  const result = { calls: responses.length, inputTokens: 0, outputTokens: 0, webSearchCalls: 0, estimatedUsd: 0, responseIds: [] as string[], telemetryVersion: 2 as const, telemetryComplete: true };
  for (const response of responses) {
    const usage = object(response.usage);
    const id = response.id;
    if (typeof id === "string" && result.responseIds.includes(id)) {
      result.telemetryComplete = false;
      continue;
    }
    const complete = typeof id === "string" && id.length > 0 && !result.responseIds.includes(id) &&
      counter(usage.input_tokens) && counter(usage.output_tokens) && Array.isArray(response.output);
    if (!complete) result.telemetryComplete = false;
    if (typeof id === "string" && id.length > 0 && !result.responseIds.includes(id)) result.responseIds.push(id);
    if (counter(usage.input_tokens)) result.inputTokens += usage.input_tokens;
    if (counter(usage.output_tokens)) result.outputTokens += usage.output_tokens;
    if (Array.isArray(response.output)) result.webSearchCalls += response.output.filter(item => object(item).type === "web_search_call").length;
  }
  // Existing gpt-5-mini technical estimate; not an invoice or a refunded reservation.
  result.estimatedUsd = Number((result.inputTokens * 0.25 / 1_000_000 + result.outputTokens * 2 / 1_000_000 + result.webSearchCalls * 0.01).toFixed(8));
  return result;
}
