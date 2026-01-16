import { describe, it, expect } from "vitest";

// Basic smoke test to ensure testing setup works
describe("basic smoke", () => {
  it("NODE_ENV is test", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });
});

