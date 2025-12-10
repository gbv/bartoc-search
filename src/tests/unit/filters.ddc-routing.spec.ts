// tests/unit/filters.ddc-routing.spec.ts
import { describe, it, expect } from "vitest";
import { parseRepeatableFilters } from "../../server/utils/filters"; // adjust path

describe("parseRepeatableFilters - DDC routing", () => {
  it("routes 1-digit to ddc_root_ss", () => {
    const out = parseRepeatableFilters(["ddc:4"]);
    expect(out.ddc_root_ss).toEqual(["4"]);
    // other buckets should be empty / undefined
    expect(out.ddc_ancestors_ss ?? []).toEqual([]);
    expect(out.ddc_ss ?? []).toEqual([]);
  });

  it("routes 2-digit to ddc_ss (exact)", () => {
    const out = parseRepeatableFilters(["ddc:42"]);

    // 2-digit integer notation is treated as an exact DDC code
    expect(out.ddc_ss).toEqual(["42"]);

    // No root or ancestors for this simple case
    expect(out.ddc_root_ss ?? []).toEqual([]);
    expect(out.ddc_ancestors_ss ?? []).toEqual([]);
  });

  it("routes 3+ integer digits to ddc_ss (exact)", () => {
    const out = parseRepeatableFilters(["ddc:420,453"]);
    expect(new Set(out.ddc_ss)).toEqual(new Set(["420", "453"]));
    expect(out.ddc_root_ss ?? []).toEqual([]);
    expect(out.ddc_ancestors_ss ?? []).toEqual([]);
  });

  it("routes decimals to ddc_ss (exact)", () => {
    const out = parseRepeatableFilters(["ddc:32.1,792.7"]);
    expect(new Set(out.ddc_ss)).toEqual(new Set(["32.1", "792.7"]));
  });

  it("normalizes DDC URIs to notation first", () => {
    const out = parseRepeatableFilters([
      "ddc:http://dewey.info/class/420/e23/,http://dewey.info/class/32.1/e23/",
    ]);
    expect(new Set(out.ddc_ss)).toEqual(new Set(["420", "32.1"]));
    expect(out.ddc_root_ss ?? []).toEqual([]);;
    expect(out.ddc_ancestors_ss ?? []).toEqual([]);
  });

  it("merges across multiple filter instances and dedupes", () => {
    const out = parseRepeatableFilters([
      "ddc:4",
      "ddc:4,42,http://dewey.info/class/420/e23/,http://dewey.info/class/32.1/e23/",
    ]);

    expect(new Set(out.ddc_root_ss)).toEqual(new Set(["4"]));
    expect(new Set(out.ddc_ss)).toEqual(new Set(["42", "420", "32.1"]));
    expect(out.ddc_ancestors_ss ?? []).toEqual([]);
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
