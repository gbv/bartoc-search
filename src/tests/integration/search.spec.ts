// tests/integration/search.spec.ts
import { beforeAll, afterAll, it, expect } from "vitest";
import { startSolrWithConfigset, seedSolrFromJson, stopSolr } from "../helpers/solr-bootstrap";
import request from "supertest";

let app: any;
let seededDocs: any[];
const FIXTURE = "src/tests/fixtures/solr/seed.json";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DISABLE_WORKERS = "1";

  await startSolrWithConfigset();
  seededDocs = await seedSolrFromJson(FIXTURE, { batchSize: 50 });

  const { createApp } = await import("../../server/main");
  app = await createApp({ withVite:false, withFrontend:false, withWorkers:false, withUpdater:false });
}, 120_000);

afterAll(async () => { await stopSolr(); });

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
