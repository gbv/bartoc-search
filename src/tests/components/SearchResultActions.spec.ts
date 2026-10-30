// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import SearchResultActions from "../../client/components/SearchResultActions.vue"

function mountSearchResultActions(props = {}) {
  return mount(SearchResultActions, {
    props: {
      summary: { from: 1, to: 10, total: 42 },
      canLoadMore: true,
      downloadUrl: "/api/search?format=jskos",
      ...props,
    },
    global: { stubs: { "font-awesome-icon": true } },
  })
}

describe("SearchResultActions", () => {
  afterEach(() => {
    document.body.className = ""
    vi.restoreAllMocks()
  })

  it("formats the result summary", () => {
    const wrapper = mountSearchResultActions({
      summary: { from: 11, to: 20, total: 999 },
    })

    expect(wrapper.text()).toContain("Showing 11 - 20 of 999 results")
  })

  it("emits events for expanding results", async () => {
    const wrapper = mountSearchResultActions()

    await wrapper.get(".search-result-actions__more-mobile").trigger("click")
    await wrapper.get(".search-result-actions__more-actions").trigger("click")
    await wrapper.get(".search-result-actions__all").trigger("click")

    expect(wrapper.emitted("load-more")).toHaveLength(2)
    expect(wrapper.emitted("show-all")).toHaveLength(1)
  })

  it("emits sort changes", async () => {
    const wrapper = mountSearchResultActions()

    await wrapper.get("select").setValue("created asc")

    expect(wrapper.emitted("sort")).toEqual([[{ sort: "created", order: "asc" }]])
  })

  it("can hide sort controls", () => {
    const wrapper = mountSearchResultActions({ showSort: false })

    expect(wrapper.find("select").exists()).toBe(false)
    expect(wrapper.find(".edition-mode").exists()).toBe(false)
    expect(wrapper.text()).toContain("Showing 1 - 10 of 42 results")
  })

  it("selects an edition mode and displays the matching count", async () => {
    const wrapper = mountSearchResultActions({ matchingEditionCount: 12 })
    const radios = wrapper.findAll('.edition-mode input[type="radio"]')

    expect(wrapper.get(".edition-mode legend").text()).toBe("Editions in search results")
    expect(radios.map(radio => radio.attributes("value"))).toEqual(["exclude", "include", "only"])
    expect(wrapper.get(".edition-mode__count-desktop").text()).toBe("12 matching")

    await radios[2].setValue()
    expect(wrapper.emitted("update:editionMode")).toEqual([["only"]])

    await wrapper.setProps({ editionMode: "only", matchingEditionCount: 0 })
    expect((radios[2].element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get(".edition-mode__count-mobile").text()).toBe("0 editions")
    expect(wrapper.get(".edition-mode__count-desktop").text()).toBe("0 matching")

    await wrapper.setProps({ matchingEditionCount: undefined })
    expect(wrapper.find(".edition-mode__count").exists()).toBe(false)
  })

  it("hides buttons from print output", () => {
    const wrapper = mountSearchResultActions()

    expect(wrapper.get(".search-result-actions__buttons").classes()).toContain("noprint")
  })

  it("enables restricted print mode while printing", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {})
    const wrapper = mountSearchResultActions()

    await wrapper.get(".search-result-actions__print").trigger("click")

    expect(print).toHaveBeenCalledTimes(1)
    expect(document.body.classList.contains("print-search-results")).toBe(true)

    window.dispatchEvent(new Event("afterprint"))

    expect(document.body.classList.contains("print-search-results")).toBe(false)
  })
})
