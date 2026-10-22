// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils"
import { nextTick, ref } from "vue"
import { createMemoryHistory, createRouter } from "vue-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import TheHeader from "../../client/components/TheHeader.vue"

const UserStatusStub = {
  template: "<div class=\"user-status-stub\" />",
}
const addButtonSelector = ".bartoc-header__nav-right .cc-button"

async function mountHeader(initialToken: string | null = null) {
  const token = ref(initialToken)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "search", component: { template: "<div />" } },
      { path: "/other", name: "other", component: { template: "<div />" } },
    ],
  })
  await router.push("/")
  await router.isReady()

  const wrapper = mount(TheHeader, {
    global: {
      plugins: [router],
      provide: {
        "login-refs": { token },
      },
      stubs: {
        UserStatus: UserStatusStub,
      },
    },
  })

  return { wrapper, token, router }
}

describe("TheHeader", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps only Terminologies active on the search route", async () => {
    const { wrapper, router } = await mountHeader()
    const link = wrapper.get('a[href="/vocabularies"]')

    expect(link.classes()).toContain("bartoc-header__nav-link--active")
    expect(link.attributes("aria-current")).toBe("page")
    expect(wrapper.findAll('a[aria-current="page"]')).toHaveLength(1)

    await wrapper.get(".bartoc-header__menu-button").trigger("click")
    expect(link.attributes("aria-current")).toBe("page")

    await router.push("/other")
    await nextTick()
    expect(wrapper.findAll('a[aria-current="page"]')).toHaveLength(0)

    await router.push("/")
    await nextTick()
    expect(link.attributes("aria-current")).toBe("page")
  })

  it("shows Add Button after authorization succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)

    const { wrapper, token } = await mountHeader()

    expect(wrapper.find(addButtonSelector).exists()).toBe(false)

    token.value = "test-token"
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      "https://bartoc.org/api/checkAuth?type=schemes&action=create",
      {
        headers: {
          Authorization: "Bearer test-token",
        },
      },
    )

    expect(wrapper.get(addButtonSelector).attributes("href"))
        .toBe("https://dev.bartoc.org/edit")

    token.value = null
    await flushPromises()

    expect(wrapper.find(addButtonSelector).exists()).toBe(false)
  })

  it("keeps Add hidden when authorization fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))

    const { wrapper } = await mountHeader("test-token")
    await flushPromises()

    expect(wrapper.find(addButtonSelector).exists()).toBe(false)
  })

  it("keeps Add hidden when authorization request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    )

    const { wrapper } = await mountHeader("test-token")
    await flushPromises()

    expect(wrapper.find(addButtonSelector).exists()).toBe(false)
  })
})
