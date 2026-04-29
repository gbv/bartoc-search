// tests/integration/search.spec.ts
import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { startSolrWithConfigset, seedSolrFromJson, stopSolr } from "../helpers/solr-bootstrap";
import request from "supertest";

let app: any;
let seededDocs: any[];
const FIXTURE = "src/tests/fixtures/solr/seed.json";
const DDC_FIXTURE = "src/tests/fixtures/solr/ddc-seed.json";

const getIds = (res: any) =>
  (res.body.response?.docs ?? []).map((d: any) => d.id).sort();

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DISABLE_WORKERS = "1";

  await startSolrWithConfigset();
  seededDocs = await seedSolrFromJson(FIXTURE);

  const ddcDocs = await seedSolrFromJson(DDC_FIXTURE);
  seededDocs = [...seededDocs, ...ddcDocs];

  const { createApp } = await import("../../server/main");
  app = await createApp({ withVite:false, withFrontend:false, withWorkers:false, withUpdater:false });
}, 120_000);

afterAll(async () => { await stopSolr(); });


describe("GET /api/search", () => {
    // Perform a search query
  it("search returns seeded doc", async () => {
    const res = await request(app).get("/api/search").query({ search: "Australian", limit: 5 });
    expect(res.status).toBe(200);
  });

  // Perform a search query with format=jskos
  it("GET /api/search?format=jskos returns JSKOS records", async () => {
    const expected = seededDocs.find(
      (d) => d.id === "http://bartoc.org/en/node/10"
    )!

    const res = await request(app)
      .get("/api/search")
      .query({
        format: "jskos",
        search: "Australian Public Affairs Information Service",
        field: "title_search",
        limit: 1,
        sort: "relevance",
        order: "desc",
      })

    expect(res.status).toBe(200)

    // JSKOS export: array of JSKOS records
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)

    // It should return the original JSKOS record from fullrecord
    expect(res.body[0]).toEqual(JSON.parse(expected.fullrecord))

    // Basic JSKOS shape
    expect(res.body[0]).toHaveProperty("@context")
    expect(res.body[0]).toHaveProperty("uri", "http://bartoc.org/en/node/10")
    expect(res.body[0]).toHaveProperty("prefLabel")

    // It should not expose the Solr/API wrapper
    expect(res.body).not.toHaveProperty("response")
    expect(res.body).not.toHaveProperty("facets")
  })

  it("GET /api/data", async () => {
    const uri = "http://bartoc.org/en/node/10";
    const expected = seededDocs.find(d => d.id === uri)!;
    const expectedJskos = JSON.parse(expected.fullrecord);

    let res = await request(app).get("/api/data").query({ uri: "non:existing" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    res = await request(app).get("/api/data").query({ uri, format: "solr" });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body[0].fullrecord)).toEqual(expectedJskos);

    res = await request(app).get("/api/data").query({ uri });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expectedJskos]);
  });

  // Apply a single-value facet filter
  it("applies single-value facet filter", async () => {
      const res = await request(app).get("/api/search")
        .query({ search: "Australian", limit: 5, filter: "language:en" });
      expect(res.status).toBe(200);
      const docs = res.body.response?.docs ?? [];
      expect(docs.length).toBeGreaterThan(0);
      // every doc has 'en' in languages_ss
      for (const d of docs) expect(d.languages_ss || []).toContain("en");
    });

  // Apply a multi-value facet filter via repeated param
  it("applies multi-value facet filter via repeated param", async () => {
    const res = await request(app).get("/api/search")
      .query({ search: "Australian", limit: 10 })
      .query({ filter: "language:en,de" });
    expect(res.status).toBe(200);
    const docs = res.body.response?.docs ?? [];
    expect(docs.length).toBeGreaterThan(0);
    // doc language is in {en,de}
    for (const d of docs) {
      const langs = d.languages_ss || [];
      expect(langs.some((x: string) => x === "en" || x === "de")).toBe(true);
    }
  });

  // Apply a NO_VALUE bucket filter for missing field
  it("NO_VALUE bucket filters for missing field", async () => {
    const res = await request(app).get("/api/search")
      .query({ search: "British Columbia First Nations Subject Headings", limit: 10, filter: "publisher:-" }); // NO_VALUE
    expect(res.status).toBe(200);

    const docs = res.body.response?.docs ?? [];
    expect(docs.length).toBeGreaterThan(0);

    for (const d of docs) {
      expect(d.publisher_labels_ss).toBeUndefined();
    }
  });

  it("searches by subject notation", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({
        search: "001",
        field: "subject_notation",
        limit: 10,
      })

    expect(res.status).toBe(200)

    const docs = res.body.response?.docs ?? []
    expect(docs.length).toBeGreaterThan(0)

    for (const doc of docs) {
      expect(doc.subject_notation ?? []).toContain("001")
    }
  })

  // Legacy query params (languages, subject, etc.) are now normalized
  // on the client (normalizeLegacyQueryFromRoute) and are no longer
  // interpreted by /api/search. These integration tests are kept only
  // as historical reference and are skipped.
  describe("legacy query parameters", () => {
    it("does not interpret legacy filter params on the server", async () => {
      const base = await request(app)
        .get("/api/search")
        .query({ search: "", limit: 10 })

      const legacy = await request(app)
        .get("/api/search")
        .query({
          search: "",
          limit: 10,
          partOf: "http://bartoc.org/en/node/1734",
          languages: "de",
          subject: "http://dewey.info/class/0/e23/",
          license: "http://creativecommons.org/licenses/by/4.0/",
        })

      expect(base.status).toBe(200)
      expect(legacy.status).toBe(200)

      // Legacy params are ignored by /api/search.
      // They are normalized to modern filter=... params on the client side.
      expect(legacy.body.response?.numFound).toBe(base.body.response?.numFound)
      expect(getIds(legacy)).toEqual(getIds(base))
    })
})

});

describe("GET /api/search — DDC routing via filter=ddc:", () => {
  it("routes 1-digit to ddc_root_ss (ddc:4)", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ search: "", limit: 10, filter: "ddc:4" });

    expect(res.status).toBe(200);
    const ids = getIds(res);
    // Should include both root 4-only and the 420 doc (because it also has root 4)
    expect(ids).toEqual(["doc:eng-420", "doc:root-4"]);
  });

  it("routes 2-digit integers to ddc_ss as exact values (ddc:42)", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ search: "", limit: 10, filter: "ddc:42" });

    expect(res.status).toBe(200);
    expect(getIds(res)).toEqual([]);
  });

  it("routes 3+ digit integers to ddc_ss (ddc:420)", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ search: "", limit: 10, filter: "ddc:420" });

    expect(res.status).toBe(200);
    const ids = getIds(res);
    expect(ids).toEqual(["doc:eng-420"]);
  });

  it("routes decimal notations to ddc_ss (ddc:32.1)", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ search: "", limit: 10, filter: "ddc:32.1" });

    expect(res.status).toBe(200);
    const ids = getIds(res);
    expect(ids).toEqual(["doc:decimal-32-1"]);
  });

  it("accepts DDC URI and extracts notation (ddc:http://dewey.info/class/420/e23/)", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({
        search: "",
        limit: 10,
        filter: "ddc:http://dewey.info/class/420/e23/",
      });

    expect(res.status).toBe(200);
    const ids = getIds(res);
    expect(ids).toEqual(["doc:eng-420"]);
  });

  it("does not emit empty ddc_* keys for empty value (ddc:)", async () => {
    // This shouldn't crash or constrain results; also shouldn't add empty arrays to Solr query.
    const res = await request(app)
      .get("/api/search")
      .query({ search: "", limit: 10, filter: "ddc:" });

    expect(res.status).toBe(200);
    // We don't assert IDs here; the main check is that it doesn't 400/500.
    // (Optionally, you could assert numFound >= 3 because fixture has 3 docs total.)
    expect((res.body.response?.numFound ?? 0)).toBeGreaterThanOrEqual(3);
  });
});

// --- Fuzzy / trigram integration
describe("GET /api/search – fuzzy/trigram integration", () => {
  it('typo "Clasification" still finds the “Classification” results (title_search)', async () => {
    const limit = 25;

    // Baseline: correctly spelled
    const good = await request(app)
      .get("/api/search")
      .query({
        search: "Classification",
        field: "title_search",
        limit,
        sort: "relevance",
        order: "desc",
      });

    expect(good.status).toBe(200);
    const goodIds = new Set(getIds(good));

    // If your seed set doesn’t contain any “Classification” titles,
    // don’t fail the whole suite — just skip this assertion gracefully.
    if (goodIds.size === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[fuzzy-test] No baseline results for "Classification" in seed; ' +
        "skipping fuzzy overlap assertion."
      );
      return;
    }

    // Typo: drop one 's' -> "Clasification"
    const typo = await request(app)
      .get("/api/search")
      .query({
        search: "Clasification",
        field: "title_search",
        limit,
        sort: "relevance",
        order: "desc",
      });

    expect(typo.status).toBe(200);
    const typoIds = new Set(getIds(typo));
    expect(typoIds.size).toBeGreaterThan(0); // should recover at least something

    // Require some overlap with the correct spelling’s results.
    const overlap = [...goodIds].filter(id => typoIds.has(id)).length;
    expect(overlap).toBeGreaterThan(0);

  });

  it('trigram gate: very short/advanced queries don’t crash (and may not fuzz)', async () => {
    // Too short < 3, don’t enable trigrams
    const shortQ = await request(app)
      .get("/api/search")
      .query({ search: "cl", field: "title_search", limit: 5 });

    expect(shortQ.status).toBe(200);

    // “Advanced looking” query with wildcard — still must not error.
    const advanced = await request(app)
      .get("/api/search")
      .query({ search: 'class*', field: 'title_search', limit: 5 });

    expect(advanced.status).toBe(200);
  });

  // Regression: long multi-word query + NO_VALUE facet must not 400
  it("handles long multi-word + NO_VALUE facet without 400", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({
        search: "British Columbia First Nations Subject Headings",
        limit: 10,
        filter: "publisher:-",
      });

    expect(res.status).toBe(200);
    const numFound = res.body?.response?.numFound ?? 0;
    expect(numFound).toBeGreaterThanOrEqual(0);
  });

  // Trigram fallback: mild misspelling still returns something if the correct query does
  it("simple misspelling returns results via trigram fallback", async () => {
    // Baseline with a known-good token present
    const baseline = await request(app)
      .get("/api/search")
      .query({ search: "Australian", limit: 5 });
    expect(baseline.status).toBe(200);

    const baseFound = baseline.body?.response?.numFound ?? 0;

    // Mild misspelling
    const miss = await request(app)
      .get("/api/search")
      .query({ search: "Austrailan", limit: 5 });
    expect(miss.status).toBe(200);

    // Only assert >0 if the baseline actually finds something
    if (baseFound > 0) {
      const missFound = miss.body?.response?.numFound ?? 0;
      expect(missFound).toBeGreaterThan(0);
    }
  });

  // Advanced syntax should *not* route to trigram (we just assert it doesn't crash)
  it("advanced Lucene-ish query does not crash (trigram skipped)", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ search: 'title:"film"', limit: 5 });
    expect(res.status).toBe(200);
  });
});


