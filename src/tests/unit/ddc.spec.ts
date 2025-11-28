// tests/unit/ddc.spec.ts
import { describe, it, expect } from "vitest";
import { extractDdc, toDdcRoot, DDC_URI_RE } from "../../server/utils/ddc"; 
import { expandDdcConcept } from "../../server/ddc/enrich";
import { DdcConcept } from "../../server/ddc/types";

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

describe("expandDdcConcept simple 3-digit class", () => {
  it("expands 440 with ancestors and labels", () => {
    const c: DdcConcept = {
      uri: "http://dewey.info/class/440/e23/",
      notation: ["440"],
      prefLabel: { en: "Romance languages; French" },
      ancestors: [
        {
          uri: "http://dewey.info/class/44/e23/",
          notation: ["44"],
          prefLabel: { en: "French & related languages" },
        },
        {
          uri: "http://dewey.info/class/4/e23/",
          notation: ["4"],
          prefLabel: { en: "Language" },
        },
      ],
      memberSet: [],
    };

    const e = expandDdcConcept(c);

    expect(e.roots).toEqual(["4"]);
    expect(e.ancestors).toEqual(["44"]);
    expect(e.exact).toEqual(["440"]);

    expect(e.labels.rank1).toEqual(["Romance languages; French"]);
    expect(e.labels.rank2).toEqual(["French & related languages"]);
    expect(e.labels.rank3).toEqual(["Language"]);
  });
});

describe("expandDdcConcept class with memberSet (971)", () => {
  it("collects roots, ancestors and ranked labels", () => {
    const c: DdcConcept = {
      uri: "http://dewey.info/class/971/e23/",
      notation: ["971"],
      prefLabel: { en: "Canada" },
      ancestors: [
        {
          uri: "http://dewey.info/class/97/e23/",
          notation: ["97"],
          prefLabel: { en: "History of North America" },
        },
        {
          uri: "http://dewey.info/class/9/e23/",
          notation: ["9"],
          prefLabel: { en: "History & geography" },
        },
      ],
      memberSet: [
        {
          uri: "http://dewey.info/class/9/e23/",
          notation: ["9"],
          prefLabel: { en: "History & geography" },
        },
        {
          uri: "http://dewey.info/class/2--71/e23/",
          notation: ["2--71"],
          prefLabel: { en: "Canada" },
        },
      ],
    };

    const e = expandDdcConcept(c);

    // numeric buckets
    expect(e.roots).toEqual(["9"]);
    expect(e.ancestors).toEqual(["97"]);
    expect(e.exact).toEqual(["971"]);

    // label buckets
    expect(e.labels.rank1).toEqual(["Canada"]);
    expect(e.labels.rank2).toEqual([
      "History of North America",
      "History & geography",
      "Canada",
    ]);
    expect(e.labels.rank3).toEqual(["History & geography"]);
  });
});


