import { describe, it, expect, vi, afterEach } from "vitest"

// @ts-ignore - JS client utility has no TypeScript declaration
import { ensureLabels } from "../../client/constants/facetLabels"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("ensureLabels", () => {
  it("returns an empty object during SSR without fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await ensureLabels(`ssr-test-${Date.now()}`, "/data/test.json")

    expect(result).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fetches a label map in the browser and caches it", async () => {
    const labels = {
      "3": "Social sciences",
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(labels),
    })

    vi.stubGlobal("window", {})
    vi.stubGlobal("fetch", fetchMock)

    const name = `ddc-test-${Date.now()}`

    const first = await ensureLabels(name, "/data/ddc-labels.json")
    const second = await ensureLabels(name, "/data/ddc-labels.json")

    expect(first).toEqual(labels)
    expect(second).toBe(first)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/data/ddc-labels.json", {
      cache: "no-cache",
    })
  })
})