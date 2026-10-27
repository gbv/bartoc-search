import { afterEach, describe, expect, it, vi } from "vitest"

// @ts-ignore - JS client utility has no TypeScript declaration
import { fetchSearchResults } from "../../client/utils/searchApi"

describe("fetchSearchResults", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("builds API params and normalizes the response", async () => {
    let requestedUrl = ""

    vi.stubGlobal("fetch", vi.fn(async (url) => {
      requestedUrl = String(url)

      return {
        ok: true,
        json: async () => ({
          response: {
            docs: [{ id: "1" }, null, "bad"],
            numFound: 3,
          },
          facets: { language: { buckets: [] } },
          matchingEditionCount: 2,
          parentTitles: { "http://bartoc.org/en/node/21146": "Thesaurus for the Social Sciences" },
        }),
      }
    }))

    const result = await fetchSearchResults({
      baseQuery: {
        empty: "",
        limit: "50",
        search: "film",
        sort: "relevance",
        start: "40",
      },
      filters: ["language:en", "type:thesaurus"],
      limit: 10,
      baseUrl: "/base/",
    })

    const url = new URL(requestedUrl, "http://example.test")

    expect(url.pathname).toBe("/base/api/search")
    expect(url.searchParams.get("search")).toBe("film")
    expect(url.searchParams.get("sort")).toBe("relevance")
    expect(url.searchParams.has("empty")).toBe(false)
    expect(url.searchParams.get("start")).toBe("0")
    expect(url.searchParams.get("limit")).toBe("10")
    expect(url.searchParams.getAll("filter")).toEqual(["language:en", "type:thesaurus"])
    expect(result).toEqual({
      docs: [{ id: "1" }],
      numFound: 3,
      facets: { language: { buckets: [] } },
      matchingEditionCount: 2,
      parentTitles: { "http://bartoc.org/en/node/21146": "Thesaurus for the Social Sciences" },
    })
  })

  it("throws on failed responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 500,
    })))

    await expect(fetchSearchResults({
      baseQuery: {},
      filters: [],
      limit: 10,
      baseUrl: "/",
    })).rejects.toThrow("Status 500")
  })
})
