import { describe, it, expect } from "vitest";

describe("basic smoke", () => {
  it("adds numbers", () => {
    expect(2 + 2).toBe(4);
  });

  it("NODE_ENV is test", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });
});

