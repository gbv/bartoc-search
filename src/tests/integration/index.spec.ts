import { beforeAll, it, expect } from "vitest";
import request from "supertest";

let createApp: any; let app: any;
beforeAll(async () => {
  ({ createApp } = await import("../../server/main"));
  app = await createApp({ withVite:true, withFrontend:true, withWorkers:false, withUpdater:false });
});

// Loading the index page
it("GET / returns HTML", async () => {
  const res = await request(app).get("/");
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toMatch(/text\/html/);
  expect(res.text).toMatch(/<!DOCTYPE html>/i);
});
