// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSSRApp, nextTick } from "vue"
import { renderToString } from "vue/server-renderer"
import SearchFacetDrawer from "../../client/components/SearchFacetDrawer.vue"

// The drawer tests do not need the facet module's browser-time label requests.
vi.mock("../../client/constants/facetFieldLabels.js", () => ({ FACET_FIELD_LABELS: {} }))

const wrappers: Array<{ unmount: () => void }> = []
const originalOverflow = document.body.style.overflow

function mountDrawer(props = {}) {
  const wrapper = mount(SearchFacetDrawer, {
    attachTo: document.body,
    props: { facets: {}, ...props },
    global: {
      stubs: {
        SearchSidebar: {
          name: "SearchSidebar",
          emits: ["modal-toggle"],
          template: `
            <div>
              <button class="first-facet" @click="$emit('modal-toggle', 'language')">First</button>
              <button class="last-facet">Last</button>
            </div>
          `,
        },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ""
  document.body.style.overflow = originalOverflow
})

describe("SearchFacetDrawer", () => {
  it("does not render the closed drawer in the initial HTML", async () => {
    const html = await renderToString(createSSRApp(SearchFacetDrawer, {
      facets: {},
      showSidebar: false,
    }))

    expect(html).not.toContain('id="mobile-facets-panel"')
    expect(html).not.toContain("Back")
  })

  it("locks scrolling and returns focus when it closes", async () => {
    const trigger = document.createElement("button")
    document.body.append(trigger)
    document.body.style.overflow = "auto"
    const wrapper = mountDrawer({ returnFocusTo: trigger })

    await wrapper.setProps({ open: true })
    await nextTick()
    expect(document.body.style.overflow).toBe("hidden")
    expect(document.activeElement).toBe(wrapper.get(".mobile-facets-back").element)

    await wrapper.setProps({ open: false })
    await nextTick()
    expect(document.body.style.overflow).toBe("auto")
    expect(document.activeElement).toBe(trigger)
  })

  it("restores scrolling when unmounted while open", async () => {
    document.body.style.overflow = "auto"
    const wrapper = mountDrawer({ open: true })
    await nextTick()

    expect(document.body.style.overflow).toBe("hidden")
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(document.body.style.overflow).toBe("auto")
  })

  it("emits close for Escape and Back", async () => {
    const wrapper = mountDrawer({ open: true })
    await nextTick()

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await wrapper.get(".mobile-facets-back").trigger("click")

    expect(wrapper.emitted("close")).toHaveLength(2)
  })

  it("keeps Tab inside the open drawer", async () => {
    const wrapper = mountDrawer({ open: true, showSidebar: true })
    await nextTick()
    const back = wrapper.get(".mobile-facets-back").element as HTMLButtonElement
    const last = wrapper.get(".last-facet").element as HTMLButtonElement

    last.focus()
    const forward = new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
    window.dispatchEvent(forward)
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(back)

    const backward = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true })
    window.dispatchEvent(backward)
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    const outside = document.createElement("button")
    document.body.append(outside)
    outside.focus()
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }))
    expect(document.activeElement).toBe(back)
  })

  it("keeps Tab in the nested facet dialog", async () => {
    const wrapper = mountDrawer({ open: true, showSidebar: true })
    await nextTick()
    const opener = wrapper.get(".first-facet")
    const openerElement = opener.element as HTMLElement
    openerElement.focus()
    const modal = document.createElement("div")
    modal.className = "facet-modal"
    modal.setAttribute("aria-modal", "true")
    modal.innerHTML = '<button class="facet-modal-close">Close</button>'
    document.body.append(modal)

    await opener.trigger("click")
    await nextTick()
    expect(document.activeElement).toBe(modal.querySelector("button"))

    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
    window.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(modal.querySelector("button"))

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(wrapper.emitted("close")).toBeUndefined()

    modal.remove()
    wrapper.findComponent({ name: "SearchSidebar" }).vm.$emit("modal-toggle", null)
    await nextTick()
    expect(document.activeElement).toBe(openerElement)
  })
})
