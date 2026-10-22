// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils"
import { createSSRApp } from "vue"
import { renderToString } from "vue/server-renderer"
import { beforeEach, describe, expect, it, vi } from "vitest"
import axios from "axios"
import TheFooter from "../../client/components/TheFooter.vue"

vi.mock("axios", () => ({ default: { get: vi.fn() } }))

const getStatus = vi.mocked(axios.get)

beforeEach(() => {
  getStatus.mockReset()
})

describe("TheFooter", () => {
  it("keeps initial SSR and client content in sync", async () => {
    const html = await renderToString(createSSRApp(TheFooter))
    expect(html).toContain("Search index not available!")
    expect(html).not.toContain("as of")

    getStatus.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(TheFooter)
    expect(wrapper.text()).toContain("Search index not available!")
  })

  it("formats the index date and keeps the status and links", async () => {
    getStatus.mockResolvedValue({
      data: {
        solr: { connected: true, indexedRecords: 4152, lastIndexedAt: "2026-10-22T08:29:08.383Z" },
        jskosServer: { connected: true },
      },
    })
    const wrapper = mount(TheFooter)
    await flushPromises()

    expect(getStatus).toHaveBeenCalledWith(expect.stringMatching(/\/api\/status$/))
    expect(wrapper.text()).toContain("search in 4152 terminologies")
    expect(wrapper.text()).toContain("as of 22 Oct 2026, 10:29, live updates enabled")
    expect(wrapper.get('a[href="https://github.com/gbv/bartoc.org"]').text()).toBe("BARTOC sources")
    expect(wrapper.get('a[href="https://github.com/gbv/bartoc-search"]').text()).toBe("bartoc-search sources")
  })

  it.each(["", "not-a-date"])("omits an unavailable index date (%s)", async lastIndexedAt => {
    getStatus.mockResolvedValue({
      data: {
        solr: { connected: true, indexedRecords: 4152, lastIndexedAt },
        jskosServer: { connected: false },
      },
    })
    const wrapper = mount(TheFooter)
    await flushPromises()

    expect(wrapper.text()).toContain("search in 4152 terminologies")
    expect(wrapper.text()).toContain("live updates disabled")
    expect(wrapper.text()).not.toContain("as of")
    expect(wrapper.text()).not.toContain("Invalid Date")
  })
})
