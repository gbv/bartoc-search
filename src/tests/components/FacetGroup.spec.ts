// @vitest-environment happy-dom

import { enableAutoUnmount, mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import FacetGroup from "../../client/components/FacetGroup.vue"

vi.mock("../../client/constants/facetFieldLabels.js", () => ({
  FACET_FIELD_LABELS: { languages_ss: { label: "Language", values: { en: "English" } } },
}))

const values = ["en", "de", "fr", "it", "es", "nl", "sv"]
  .map((value, index) => ({ value, count: 20 - index }))

function mountFacet(props = {}) {
  return mount(FacetGroup, {
    props: { field: "languages_ss", values, open: true, ...props },
    attachTo: document.body,
    global: { stubs: { teleport: true, "font-awesome-icon": true } },
  })
}

enableAutoUnmount(afterEach)
afterEach(() => {
  document.body.innerHTML = ""
})

describe("FacetGroup", () => {
  it("toggles the accordion while keeping selected values", async () => {
    const wrapper = mountFacet({ selected: ["en"], open: false })
    const header = wrapper.get("button[aria-expanded]")

    expect(header.attributes("aria-expanded")).toBe("false")
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)

    await header.trigger("click")
    await wrapper.setProps({ open: true })
    expect(header.attributes("aria-expanded")).toBe("true")
    expect(wrapper.get('input[aria-label="English"]').element).toHaveProperty("checked", true)
    expect(wrapper.get('input[aria-label="English"]').classes()).toContain("cc-checkbox")

    await header.trigger("click")
    expect(wrapper.emitted("toggle")).toEqual([[true], [false]])
  })

  it("changes selections through checkboxes, labels, and Enter", async () => {
    const wrapper = mountFacet({ selected: ["en"] })

    await wrapper.get('input[value="en"]').setValue(false)
    await wrapper.setProps({ selected: [] })

    await wrapper.findAll("label")[1].trigger("click")
    await wrapper.setProps({ selected: ["de"] })

    await wrapper.get('input[value="en"]').trigger("keydown.enter")
    expect(wrapper.emitted("change")).toEqual([[[]], [["de"]], [["de", "en"]]])
  })

  it("keeps bucket positions when updated counts change their server order", async () => {
    const wrapper = mountFacet()

    await wrapper.setProps({
      values: [{ value: "it", count: 100 }, ...values.filter(item => item.value !== "it")],
      selected: ["it"],
    })

    expect(wrapper.findAll('input[type="checkbox"]').map(input => input.attributes("value")))
      .toEqual(["en", "de", "fr", "it", "es", "nl"])
    expect(wrapper.findAll("label")[3].text()).toContain("100")

    await wrapper.get(".facet-show-more button").trigger("click")
    expect(wrapper.get('[role="dialog"]').findAll("input").map(input => input.attributes("value")))
      .toEqual(values.map(item => item.value))
  })

  it("opens See all and closes the modal with Escape", async () => {
    const wrapper = mountFacet()

    await wrapper.get(".facet-show-more button").trigger("click")
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.findAll('input[type="checkbox"]')).toHaveLength(values.length)
    expect(dialog.get('input[type="checkbox"]').classes()).toContain("cc-checkbox")

    await dialog.get("label").trigger("click")
    expect(wrapper.emitted("change")).toEqual([[["en"]]])

    await dialog.trigger("keydown", { key: "Escape" })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted("modal-toggle")).toEqual([[true], [false]])
  })
})
