import { describe, it, expect, vi } from "vitest"

// @ts-ignore - JS client utility has no TypeScript declaration
import { splitSubjectParam, normalizeLegacyQueryFromRoute } from "../../client/utils/legacy"

describe("splitSubjectParam", () => {
  it("maps DDC subject URIs to DDC root notation", () => {
    expect(splitSubjectParam("http://dewey.info/class/577/e23/")).toEqual({
      ddc: ["5"],
      subjectUris: [],
    })
  })

  it("keeps non-DDC subject URIs as subjectUris", () => {
    expect(
      splitSubjectParam("http://uri.gbv.de/terminology/bk/42.90"),
    ).toEqual({
      ddc: [],
      subjectUris: ["http://uri.gbv.de/terminology/bk/42.90"],
    })
  })

  it("splits mixed subject parameters", () => {
    expect(
      splitSubjectParam(
        "http://dewey.info/class/577/e23/|http://uri.gbv.de/terminology/bk/42.90",
      ),
    ).toEqual({
      ddc: ["5"],
      subjectUris: ["http://uri.gbv.de/terminology/bk/42.90"],
    })
  })

  it("deduplicates repeated values", () => {
    expect(
      splitSubjectParam(
        "http://dewey.info/class/577/e23/|http://dewey.info/class/577/e23/",
      ),
    ).toEqual({
      ddc: ["5"],
      subjectUris: [],
    })
  })
})

describe("normalizeLegacyQueryFromRoute", () => {
  const makeRouter = () => ({
    replace: vi.fn().mockResolvedValue(undefined),
  })

  it("rewrites non-DDC subject URIs to subject_uri search", async () => {
    const router = makeRouter()
    const expected = {
      search: "http://uri.gbv.de/terminology/bk/42.90",
      field: "subject_uri",
    }

    await expect(
      normalizeLegacyQueryFromRoute(
        {
          name: "search",
          query: { subject: "http://uri.gbv.de/terminology/bk/42.90" },
        },
        router,
      ),
    ).resolves.toEqual(expected)

    expect(router.replace).toHaveBeenCalledWith({
      name: "search",
      query: expected,
    })
  })

  it("rewrites DDC subject URIs to a DDC filter", async () => {
    const router = makeRouter()
    const expected = {
      filter: "ddc:5",
    }

    await expect(
      normalizeLegacyQueryFromRoute(
        {
          name: "search",
          query: { subject: "http://dewey.info/class/577/e23/" },
        },
        router,
      ),
    ).resolves.toEqual(expected)

    expect(router.replace).toHaveBeenCalledWith({
      name: "search",
      query: expected,
    })
  })

  it("preserves existing query parameters when rewriting subject", async () => {
    const router = makeRouter()
    const expected = {
      limit: "20",
      sort: "relevance",
      search: "http://uri.gbv.de/terminology/bk/42.90",
      field: "subject_uri",
      filter: "ddc:5",
    }

    await expect(
      normalizeLegacyQueryFromRoute(
        {
          name: "search",
          query: {
            subject: "http://dewey.info/class/577/e23/|http://uri.gbv.de/terminology/bk/42.90",
            limit: "20",
            sort: "relevance",
          },
        },
        router,
      ),
    ).resolves.toEqual(expected)

    expect(router.replace).toHaveBeenCalledWith({
      name: "search",
      query: expected,
    })
  })

  it("does not replace the route when no legacy parameter changed", async () => {
    const router = makeRouter()
    const query = {
      search: "thesaurus",
      field: "title_search",
    }

    await expect(
      normalizeLegacyQueryFromRoute(
        {
          name: "search",
          query,
        },
        router,
      ),
    ).resolves.toEqual(query)

    expect(router.replace).not.toHaveBeenCalled()
  })
})
