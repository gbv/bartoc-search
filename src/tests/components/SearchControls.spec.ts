// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
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

    const wrapper = mount(SearchControls)
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
})
