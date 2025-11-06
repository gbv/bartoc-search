// tests/unit/filters.ddc-routing.spec.ts
import { describe, it, expect } from "vitest";
import { parseRepeatableFilters } from "../../server/utils/filters"; // adjust path

describe("parseRepeatableFilters - DDC routing", () => {
  it("routes 1-digit to ddc_root_ss", () => {
    const out = parseRepeatableFilters(["ddc:4"]);
    expect(out).toEqual({ ddc_root_ss: ["4"], ddc_ancestors_ss: [], ddc_ss: [] });
  });

  it("routes 2-digit to ddc_ancestors_ss", () => {
    const out = parseRepeatableFilters(["ddc:42"]);
    expect(out).toEqual({ ddc_ancestors_ss: ["42"], ddc_root_ss: [], ddc_ss: [] });
  });

  it("routes 3+ integer digits to ddc_ancestors_ss", () => {
    const out = parseRepeatableFilters(["ddc:420,453"]);
    // order not guaranteed; compare as sets
    expect(new Set(out.ddc_ancestors_ss)).toEqual(new Set(["420", "453"]));
  });

  it("routes decimals to ddc_ss (exact)", () => {
    const out = parseRepeatableFilters(["ddc:32.1,792.7"]);
    expect(new Set(out.ddc_ss)).toEqual(new Set(["32.1", "792.7"]));
  });

  it("normalizes DDC URIs to notation first", () => {
    const out = parseRepeatableFilters([
      "ddc:http://dewey.info/class/420/e23/,http://dewey.info/class/32.1/e23/",
    ]);
    // 420 -> ancestors, 32.1 -> exact
    expect(out.ddc_ancestors_ss).toEqual(["420"]);
    expect(out.ddc_ss).toEqual(["32.1"]);
  });

  it("merges across multiple filter instances and dedupes", () => {
    const out = parseRepeatableFilters([
      "ddc:4,420",
      "ddc:42,420,32.1", // re-adding 420, mixed types
    ]);
    expect(new Set(out.ddc_root_ss)).toEqual(new Set(["4"]));
    expect(new Set(out.ddc_ancestors_ss)).toEqual(new Set(["42", "420"]));
    expect(out.ddc_ss).toEqual(["32.1"]);
  });

  it("passes through other facets unchanged and deduped", () => {
    const out = parseRepeatableFilters([
      "language:en",
      "language:en,es",
      "format:PDF,Online",
    ]);
    expect(new Set(out.languages_ss)).toEqual(new Set(["en", "es"]));
    expect(new Set(out.format_group_ss)).toEqual(new Set(["PDF", "Online"]));
  });

  it("keeps '-' (missing bucket) for later translation", () => {
    const out = parseRepeatableFilters(["api:-"]);
    expect(out.api_type_ss).toEqual(["-"]);
  });

  it("tolerates empty bucket requests (UI use)", () => {
    const out = parseRepeatableFilters(["language:"]);
    // Empty after colon means “load buckets; don’t constrain”. Parser stores empty array.
    expect(out.languages_ss).toEqual([]);
  });
});
