// tests/unit/legacy.params.spec.ts
import { describe, it, expect } from "vitest";
import { legacyFiltersFromQuery } from "../../server/utils/filters";

describe("legacyFiltersFromQuery", () => {
  it("maps partOf -> in (listed_in_ss)", () => {
    const out = legacyFiltersFromQuery({
      partOf: "http://bartoc.org/en/node/18926|http://bartoc.org/en/node/1737",
    });
    expect(new Set(out.listed_in_ss)).toEqual(
      new Set(["http://bartoc.org/en/node/18926", "http://bartoc.org/en/node/1737"]),
    );
  });

  it("maps languages -> language (languages_ss)", () => {
    const out = legacyFiltersFromQuery({ languages: "it,en" });
    expect(new Set(out.languages_ss)).toEqual(new Set(["it", "en"]));
  });

  it("maps subject DDC URIs to root digits", () => {
    const out = legacyFiltersFromQuery({
      subject: "http://dewey.info/class/4/e23/|http://dewey.info/class/420/e23/",
    });
    expect(out.ddc_root_ss).toEqual(["4"]); // root deduped to "4"
  });

  it("maps license URIs to license groups (when known)", () => {
    const out = legacyFiltersFromQuery({
      license: "http://creativecommons.org/licenses/by/4.0/",
    });
    expect(out.license_group_ss?.length).toBeGreaterThanOrEqual(0);
  });
});
