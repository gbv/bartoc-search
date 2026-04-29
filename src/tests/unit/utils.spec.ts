import { describe, it, expect } from "vitest"
// @ts-ignore - JS client utility has no TypeScript declaration
import { appendQueryToParams } from "../../client/utils/utils"

describe("appendQueryToParams", () => {
  it("appends scalar values and repeated array values", () => {
    const params = appendQueryToParams(new URLSearchParams(), {
      search: "film",
      sort: "relevance",
      filter: ["language:en", "ddc:7"],
    })

    expect(params.get("search")).toBe("film")
    expect(params.get("sort")).toBe("relevance")
    expect(params.getAll("filter")).toEqual(["language:en", "ddc:7"])
  })

  it("skips empty/null/undefined values", () => {
    const params = appendQueryToParams(new URLSearchParams(), {
      search: "",
      empty: "",
      nil: null,
      nope: undefined,
      filter: ["language:en", ""],
    })

    expect(params.has("search")).toBe(false)
    expect(params.has("empty")).toBe(false)
    expect(params.has("nil")).toBe(false)
    expect(params.has("nope")).toBe(false)
    expect(params.getAll("filter")).toEqual(["language:en"])
  })
})