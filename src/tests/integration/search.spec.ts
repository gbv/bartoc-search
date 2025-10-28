// tests/integration/search.spec.ts
import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { startSolrWithConfigset, seedSolrFromJson, stopSolr } from "../helpers/solr-bootstrap";
import request from "supertest";

let app: any;
let seededDocs: any[];
const FIXTURE = "src/tests/fixtures/solr/seed.json";

const getIds = (res: any) =>
  (res.body.response?.docs ?? []).map((d: any) => d.id).sort();

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DISABLE_WORKERS = "1";

  await startSolrWithConfigset();
  seededDocs = await seedSolrFromJson(FIXTURE);

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
  it("GET /api/search?format=jskos&uri=... filters by uri", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ format: "jskos", search: "Australian", uri: "http://bartoc.org/en/node/10", limit: 1 });

    expect(res.status).toBe(200);

    // current impl spreads the array into an object with numeric keys
    const values = Object.values(res.body);
    expect(values.length).toBeGreaterThan(0);

    const first: any = values[0];
    expect(first).toHaveProperty("created", "2013-08-14T10:23:00Z");
  });

  // Get a fullrecord Solr document by ID
  it("GET /api/solr?id=... returns the seeded fullrecord", async () => {
    const ID = "http://bartoc.org/en/node/10";
    const expectedDoc = seededDocs.find(d => d.id === ID)!;

    const res = await request(app).get("/api/solr").query({ id: ID });
    expect(res.status).toBe(200);

    // compare parsed objects to avoid string formatting diffs
    const got = JSON.parse(res.body.fullrecord);
    const expected = JSON.parse(expectedDoc.fullrecord);
    expect(got).toEqual(expected);
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
    console.log(docs.length);
    for (const d of docs) {
      expect(d.publisher_labels_ss).toBeUndefined();
    }
  });

  describe("Testing legacy params", () => {
    it("maps legacy partOf to filter:in (listed_in_ss)", async () => {
      const legacy = await request(app).get("/api/search")
        .query({ search: "", limit: 10, sort: "relevance", order: "desc", partOf: "http://bartoc.org/en/node/1734" });

      const current = await request(app).get("/api/search")
        .query({ search: "", limit: 10, sort: "relevance", order: "desc", filter: "in:http://bartoc.org/en/node/1734" });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);
      expect(legacy.body.response?.numFound).toBe(current.body.response?.numFound);
      // compare IDs:
      expect(getIds(legacy)).toEqual(getIds(current));
    });

    it("filters by single legacy languages value de", async () => {
      const legacy = await request(app).get("/api/search")
        .query({ search: "", languages: "de" });
      
      const current = await request(app).get("/api/search")
        .query({ search: "", filter: "language:de" });
      

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);
      expect(legacy.body?.response?.numFound ?? 0).toBeGreaterThan(0);
      expect(current.body?.response?.numFound ?? 0).toBeGreaterThan(0);
      expect(legacy.body.response?.numFound).toBe(current.body.response?.numFound);
      // compare IDs:
      expect(getIds(legacy)).toEqual(getIds(current));
    });

    it("filters by multiple legacy languages values de,en", async () => {
      const legacy  = await request(app).get("/api/search").query({ search: "*", languages: "de,en" });
      const current = await request(app).get("/api/search").query({ search: "*", filter: "language:de,en" });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);
      expect(getIds(legacy)).toEqual(getIds(current));
    });

    it("maps type legacy param, searching for Thesaurus", async () => {
      const legacy  = await request(app).get("/api/search").query({ search: "*", type: "http://w3id.org/nkos/nkostype#thesaurus" });
      const current = await request(app).get("/api/search").query({ search: "*", filter: "type:http://w3id.org/nkos/nkostype#thesaurus" });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);
      expect(getIds(legacy)).toEqual(getIds(current));
    });

    it("maps country legacy param", async () => {
      const legacy  = await request(app).get("/api/search").query({ search: "*", country: "Austria" });
      const current = await request(app).get("/api/search").query({ search: "*", filter: "country:austria" });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);
      expect(getIds(legacy)).toEqual(getIds(current));
    });

    it("maps access legacy param", async () => {
      const legacy  = await request(app).get("/api/search").query({ search: "*", access: "http://bartoc.org/en/Access/Free" });
      const current = await request(app).get("/api/search").query({ search: "*", filter: "access:http://bartoc.org/en/Access/Free" });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);
      expect(getIds(legacy)).toEqual(getIds(current));
    });

    it("legacy subject (dewey URI) maps to ddc root", async () => {
      // legacy: subject=http://dewey.info/class/0/e23/|
      const legacy = await request(app).get("/api/search").query({
        search: "",
        subject: "http://dewey.info/class/0/e23/|",
        limit: 10,
      });

      // current: filter=ddc:0
      const current = await request(app).get("/api/search").query({
        search: "",
        filter: "ddc:0",
        limit: 10,
      });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);

      const idsLegacy = (legacy.body.response?.docs ?? []).map((d: any) => d.id).sort();
      const idsCurrent = (current.body.response?.docs ?? []).map((d: any) => d.id).sort();

      // Both non-empty and equivalent
      expect(idsLegacy.length).toBeGreaterThan(0);
      expect(idsCurrent.length).toBeGreaterThan(0);
      expect(idsLegacy).toEqual(idsCurrent);
    });

    it("legacy subject list (dewey URI) maps to ddc roots", async () => {
      // legacy: subject=http://dewey.info/class/0/e23/|
      const legacy = await request(app).get("/api/search").query({
        search: "",
        subject: "http://dewey.info/class/0/e23/|http://dewey.info/class/6/e23/|",
        limit: 10,
      });

      // current: filter=ddc:0
      const current = await request(app).get("/api/search").query({
        search: "",
        filter: "ddc:0,6",
        limit: 10,
      });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);

      const idsLegacy = (legacy.body.response?.docs ?? []).map((d: any) => d.id).sort();
      const idsCurrent = (current.body.response?.docs ?? []).map((d: any) => d.id).sort();

      // Both non-empty and equivalent
      expect(idsLegacy.length).toBeGreaterThan(0);
      expect(idsCurrent.length).toBeGreaterThan(0);
      expect(idsLegacy).toEqual(idsCurrent);
    });

    it("legacy license maps to license group", async () => {
      // legacy: subject=http://dewey.info/class/0/e23/|
      const legacy = await request(app).get("/api/search").query({
        search: "",
        license: "http://creativecommons.org/licenses/by/4.0/",
        limit: 10,
      });

      // current: filter=ddc:0
      const current = await request(app).get("/api/search").query({
        search: "",
        filter: "license:CC BY",
        limit: 10,
      });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);

      const idsLegacy = (legacy.body.response?.docs ?? []).map((d: any) => d.id).sort();
      const idsCurrent = (current.body.response?.docs ?? []).map((d: any) => d.id).sort();

      // Both non-empty and equivalent
      expect(idsLegacy.length).toBeGreaterThan(0);
      expect(idsCurrent.length).toBeGreaterThan(0);
      expect(idsLegacy).toEqual(idsCurrent);
    });

    it("legacy list of licenses maps to license groups", async () => {
      // legacy: subject=http://dewey.info/class/0/e23/|
      const legacy = await request(app).get("/api/search").query({
        search: "",
        license: "http://creativecommons.org/licenses/by/4.0/,http://www.apache.org/licenses/LICENSE-2.0",
        limit: 10,
      });

      // current: filter=ddc:0
      const current = await request(app).get("/api/search").query({
        search: "",
        filter: "license:CC BY,Apache 2.0",
        limit: 10,
      });

      expect(legacy.status).toBe(200);
      expect(current.status).toBe(200);

      const idsLegacy = (legacy.body.response?.docs ?? []).map((d: any) => d.id).sort();
      const idsCurrent = (current.body.response?.docs ?? []).map((d: any) => d.id).sort();

      // Both non-empty and equivalent
      expect(idsLegacy.length).toBeGreaterThan(0);
      expect(idsCurrent.length).toBeGreaterThan(0);
      expect(idsLegacy).toEqual(idsCurrent);
    });

  });

});
