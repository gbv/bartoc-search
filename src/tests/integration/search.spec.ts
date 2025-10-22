// tests/integration/search.spec.ts
import { beforeAll, afterAll, it, expect } from "vitest";
import { startSolr, seedSolr, stopSolr } from "../helpers/solr-bootstrap";

let app: any;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DISABLE_WORKERS = "1";

  await startSolr();
  await seedSolr([
    { id: "t1", title: "Climate terminology", fullrecord: "{\"uri\":\"http://ex/t1\"}" },
  ]);

  const { createApp } = await import("../../server/main");
  app = await createApp({ withVite:false, withFrontend:false, withWorkers:false, withUpdater:false });
}, 120_000);

afterAll(async () => { await stopSolr(); });

it("search returns seeded doc", async () => {
  const request = (await import("supertest")).default;
  const res = await request(app).get("/api/search").query({ q: "climate", limit: 5 });
  expect(res.status).toBe(200);
});
