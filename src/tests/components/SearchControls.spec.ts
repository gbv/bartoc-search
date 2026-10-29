// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { createSSRApp } from "vue"
import { renderToString } from "vue/server-renderer"
import { afterEach, describe, expect, it, vi } from "vitest"
import SearchControls from "../../client/components/SearchControls.vue"

vi.mock("../../client/constants/facetLabels", () => ({
  ensureLabels: vi.fn(async () => ({})),
}))
// @ts-ignore - JS client store has no TypeScript declaration
import { clearFilters, setFilters } from "../../client/stores/filters"

describe("SearchControls", () => {
  afterEach(() => {
    clearFilters()
  })

  it("groups selected values by facet and removes the raw value", async () => {
    setFilters({
      languages_ss: ["it", "en"],
      format_group_ss: ["PDF"],
      license_group_ss: [],
    })

    const wrapper = mount(SearchControls, { global: { stubs: { "font-awesome-icon": true } } })
    const groups = wrapper.findAll('[role="group"]')

    expect(groups).toHaveLength(2)
    expect(groups[0].attributes("aria-label")).toBe("Language")
    expect(groups[0].findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(groups[0].text()).toContain("Italian")
    expect(groups[0].text()).toContain("English")
    expect(groups[1].attributes("aria-label")).toBe("Format Group")
    expect(groups[1].findAll('input[type="checkbox"]')).toHaveLength(1)

    await groups[0].get('input[aria-label="Language: Italian"]').setValue(false)

    expect(wrapper.emitted("remove-badge")).toEqual([
      [{ field: "languages_ss", value: "it" }],
    ])
  })
  it("offers the three edition modes and keeps the matching count", async () => {
    const wrapper = mount(SearchControls, {
      props: { matchingEditionCount: 2 },
      global: { stubs: { "font-awesome-icon": true } },
    })
    const select = wrapper.get('.edition-mode select')

    expect(wrapper.get(".edition-mode label").text()).toBe("2 editions")
    expect(wrapper.get(".edition-mode label").attributes("for")).toBe(select.attributes("id"))
    expect(select.findAll("option").map(option => option.attributes("value"))).toEqual(["exclude", "include", "only"])
    expect((select.element as HTMLSelectElement).value).toBe("exclude")

    await select.setValue("include")
    await select.setValue("only")

    expect(wrapper.emitted("update:editionMode")).toEqual([["include"], ["only"]])

    await wrapper.setProps({ editionMode: "only", matchingEditionCount: 0 })
    expect(wrapper.get(".edition-mode label").text()).toBe("0 editions")
    expect((select.element as HTMLSelectElement).value).toBe("only")

    await wrapper.setProps({ matchingEditionCount: undefioned })
    expect(wrapper.get(".edition-mode label").text()).toBe("editions")
  })

  it("renders the selected mode in HTML for direct URLs and reloads", async () => {
    const app = createSSRApp(SearchControls, { editionMode: "only" })
    app.component("font-awesome-icon", { template: "<span />" })

    const html = await renderToString(app)
    expect(html).toMatch(/<option value="only" selected(?:\s|>)/)
  })

})
