// tests/unit/ddc.spec.ts
import { describe, it, expect } from "vitest";
import { extractDdc, toDdcRoot, DDC_URI_RE } from "../../server/utils/ddc"; 

describe("DDC helpers", () => {
  it("extractDdc returns raw notations", () => {
    const subjects = [
      { uri: "http://dewey.info/class/4/e23/", notation: ["4"] },
      { uri: "http://dewey.info/class/420/e23/", notation: ["420"] },
      { uri: "http://example.org/other/xyz", notation: ["xyz"] },
    ];
    expect(extractDdc(subjects)).toEqual(["4", "420"]);
  });

  it("extractDdc rootLevel dedupes to single digits", () => {
    const subjects = [
      { uri: "http://dewey.info/class/4/e23/", notation: ["4"] },
      { uri: "http://dewey.info/class/420/e23/", notation: ["420"] },
      { uri: "http://dewey.info/class/499/e23/", notation: ["499"] },
    ];
    const out = extractDdc(subjects, { rootLevel: true }).sort();
    expect(out).toEqual(["4"]); // both 4 and 420 map to root "4"
  });

  it("toDdcRoot extracts the first digit only", () => {
    expect(toDdcRoot("https://dewey.info/class/3/e23/")).toBe("3");
    expect(toDdcRoot("http://dewey.info/class/300/e23/")).toBe("3");
    expect(toDdcRoot("http://dewey.info/class/32.1/e23/")).toBe("3");
    expect(toDdcRoot("https://example.org/foo")).toBeNull();
  });

  it("DDC_URI_RE matches DDC URIs and captures notation", () => {
    const m1 = DDC_URI_RE.exec("https://dewey.info/class/420/e23/");
    expect(m1?.[1]).toBe("420");

    const m2 = DDC_URI_RE.exec("http://dewey.info/class/32.1/e23/");
    expect(m2?.[1]).toBe("32.1");
  });
});
