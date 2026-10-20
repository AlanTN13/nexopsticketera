import { describe, expect, it } from "vitest";
import { parseMetricsConnection } from "@/lib/metrics-connection";

const source = "https://docs.google.com/spreadsheets/d/e/shared/pub?output=csv";

describe("Meta Ads account connection", () => {
  it("preserves existing configuration when both fields are omitted or blank", () => {
    expect(parseMetricsConnection()).toBeNull();
    expect(parseMetricsConnection(" ", " ")).toBeNull();
  });
  it("stores the explicit account separately from the display company name", () => {
    expect(parseMetricsConnection(" Kenta Ads ", source)).toEqual({
      accountName: "Kenta Ads",
      metaSheetUrl: source,
    });
  });
  it.each([["Kenta Ads", ""], ["", source]])("rejects incomplete configuration", (account, url) => {
    expect(() => parseMetricsConnection(account, url)).toThrow("Completá");
  });
  it.each([
    "http://docs.google.com/spreadsheets/d/source",
    "https://docs.google.com.evil.test/spreadsheets/d/source",
    "https://user:password@docs.google.com/spreadsheets/d/source",
    "https://docs.google.com:444/spreadsheets/d/source",
    "https://docs.google.com/forms/d/source",
    "https://127.0.0.1/spreadsheets/d/source",
    "not-a-url",
  ])("rejects disallowed source %s", (url) => {
    expect(() => parseMetricsConnection("Kenta Ads", url)).toThrow("Google Sheets");
  });
  it("rejects oversized values", () => {
    expect(() => parseMetricsConnection("a".repeat(201), source)).toThrow("largo");
    expect(() => parseMetricsConnection("Kenta Ads", source + "a".repeat(2048))).toThrow("largo");
  });
});
