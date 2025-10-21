import { beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/main";

let app: any;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  app = await createApp({
    withVite: false,     // no Vite middlewares in tests
    withWorkers: false,  // no WS/listeners/Bull
    withUpdater: false,  // skip artifacts updater
  });
});

describe("GET /api/status", () => {
  it("responds 200", async () => {
    const res = await request(app).get("/api/status");
    expect(res.status).toBe(200);
    // Optional: assert it returns JSON
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
