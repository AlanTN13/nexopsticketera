import { describe, expect, it } from "vitest";
import { radarBudgetUsage } from "@/lib/radar-budget-usage";
const response = (id = "resp_one") => ({ id, status: "completed", usage: { input_tokens: 100, output_tokens: 200 }, output: [{ type: "web_search_call" }] });
describe("provider telemetry reconciliation", () => {
  it("records no provider cost before a response, independently of authorized calls", () => {
    expect(radarBudgetUsage([])).toMatchObject({ calls: 0, estimatedUsd: 0, telemetryComplete: true });
  });
  it("retains usage of an incomplete editorial response", () => {
    expect(radarBudgetUsage([{ ...response(), status: "incomplete" }])).toMatchObject({ calls: 1, inputTokens: 100, outputTokens: 200, webSearchCalls: 1, estimatedUsd: 0.010425, telemetryComplete: true });
  });
  it("preserves uncertainty rather than turning missing token data into a zero-cost settlement", () => {
    expect(radarBudgetUsage([{ ...response(), usage: {} }])).toMatchObject({ estimatedUsd: 0.01, telemetryComplete: false });
  });
  it.each([NaN, Infinity, -1, 1.2, "100"])("does not reconcile invalid token telemetry %s", value => {
    expect(radarBudgetUsage([{ ...response(), usage: { input_tokens: value, output_tokens: 200 } }]).telemetryComplete).toBe(false);
  });
  it("does not consider duplicate provider IDs complete evidence", () => {
    expect(radarBudgetUsage([response(), response()])).toMatchObject({ telemetryComplete: false, estimatedUsd: 0.010425 });
    expect(radarBudgetUsage([response(), response("resp_two")])).toMatchObject({ calls: 2, estimatedUsd: 0.02085, telemetryComplete: true });
  });
});
