import { describe, expect, it } from "vitest";
import { isBartocUri, normalizeUri } from "../../server/utils/uri";

describe("normalizeUri", () => {
  it("trims strings", () => {
    expect(normalizeUri("  http://bartoc.org/en/node/20541  ")).toBe(
      "http://bartoc.org/en/node/20541",
    );
  });

  it("returns an empty string for non-string values", () => {
    expect(normalizeUri(undefined)).toBe("");
    expect(normalizeUri(null)).toBe("");
    expect(normalizeUri(20541)).toBe("");
  });
});

describe("isBartocUri", () => {
  it("recognizes canonical BARTOC record URIs", () => {
    expect(isBartocUri("http://bartoc.org/en/node/20541")).toBe(true);
  });

  it("rejects non-canonical aliases and unrelated URIs", () => {
    expect(isBartocUri("https://bartoc.org/en/node/20541")).toBe(false);
    expect(isBartocUri("http://bartoc.org/en/node/20541/")).toBe(false);
    expect(isBartocUri("https://example.org/en/node/20541")).toBe(false);
  });
});
