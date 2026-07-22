import { describe, expect, it } from "vitest";

import { getSelectedFilterValues } from "@/components/ticket-filters";

describe("ticket filter values", () => {
  it("normalizes single and repeated URL values", () => {
    expect(getSelectedFilterValues("new")).toEqual(["new"]);
    expect(getSelectedFilterValues(["new", "analysis", "new"])).toEqual([
      "new",
      "analysis",
    ]);
  });

  it("treats all and missing values as no filter", () => {
    expect(getSelectedFilterValues(undefined)).toEqual([]);
    expect(getSelectedFilterValues("all")).toEqual([]);
    expect(getSelectedFilterValues(["all", "critical"])).toEqual(["critical"]);
  });
});
