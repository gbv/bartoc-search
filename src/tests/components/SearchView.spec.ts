// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import { createMemoryHistory, createRouter } from "vue-router"
// @ts-ignore - JS client store has no TypeScript declaration
import * as filtersStore from "../../client/stores/filters"

vi.mock("../../client/utils/namespaces", () => ({
  getURIperIdentifierOrNamespace: vi.fn(() => Promise.resolve(null)),
}))

let fetchMock: ReturnType<typeof vi.fn>
const {
  clearAllBuckets,
  clearFilters,
  resetFiltersRequested,
  resetOpenGroups,
} = filtersStore

async function flushPromises() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

function searchResponse(total = 30): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      facets: {},
      response: {
        docs: total ? [
          {
            id: "http://bartoc.org/en/node/1",
            title_en: "Example vocabulary",
          },
        ] : [],
        numFound: total,
      },
    }),
  } as Response)
}

async function mountSearchView(initialQuery = {}) {
  const { default: SearchView } = await import("../../client/views/SearchView.vue")

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/",
        name: "search",
        component: SearchView,
      },
    ],
  })

  await router.push({ name: "search", query: { search: "first", limit: "10", ...initialQuery } })
  await router.isReady()

  const push = vi.spyOn(router, "push")
  const replace = vi.spyOn(router, "replace")

  const wrapper = mount(SearchView, {
    global: {
      plugins: [router],
      stubs: {
        "font-awesome-icon": true,
        NoResults: true,
        SearchBar: {
          emits: ["lookup-uri", "search"],
          template: `
            <button
              class="test-search"
              type="button"
              @click="$emit('search', { search: 'second' })">
              Search
            </button>
          `,
        },
        SearchControls: true,
        SearchResults: true,
        SearchSidebar: true,
      },
    },
  })

  await flushPromises()

  push.mockClear()
  replace.mockClear()

  return {
    push,
    replace,
    router,
    wrapper,
  }
}

describe("SearchView history navigation", () => {
  beforeEach(() => {
    fetchMock = vi.fn(() => searchResponse())
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(async () => {
    await flushPromises()
    clearFilters()
    clearAllBuckets()
    resetFiltersRequested()
    resetOpenGroups()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("pushes new searches but replaces more-results navigation", async () => {
    const { push, replace, router, wrapper } = await mountSearchView()

    await wrapper.get(".test-search").trigger("click")
    await flushPromises()

    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({
      name: "search",
      query: expect.objectContaining({
        limit: "10",
        search: "second",
      }),
    })
    expect(replace).not.toHaveBeenCalled()

    push.mockClear()
    replace.mockClear()

    await wrapper.get(".search-result-actions__more-actions").trigger("click")
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({
      name: "search",
      query: expect.objectContaining({
        limit: "20",
        search: "second",
      }),
    })

    push.mockClear()
    replace.mockClear()

    router.back()
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("search=first")
  })

  it("keeps the edition mode in the route and API request", async () => {
    const { router, wrapper } = await mountSearchView()
    const checkedMode = () => wrapper.get('.edition-mode input:checked').attributes("value")

    expect(checkedMode()).toBe("exclude")

    await wrapper.get('.edition-mode input[value="include"]').setValue()
    await flushPromises()

    expect(router.currentRoute.value.query.editions).toBe("true")
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=true")

    await wrapper.get('.edition-mode input[value="only"]').setValue()
    await flushPromises()
    expect(router.currentRoute.value.query.editions).toBe("only")
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=only")
    expect(wrapper.get(".search-result-actions__download").attributes("href")).toContain("editions=only")

    await wrapper.get('.edition-mode input[value="exclude"]').setValue()
    await flushPromises()
    expect(router.currentRoute.value.query.editions).toBeUndefined()
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).not.toContain("editions=")
  })

  it("restores an editions-only URL on reload and browser navigation", async () => {
    const { router, wrapper } = await mountSearchView({ editions: "only", limit: "30", start: "20" })
    const checkedMode = () => wrapper.get('.edition-mode input:checked').attributes("value")

    expect(checkedMode()).toBe("only")
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=only")

    await wrapper.get('.edition-mode input[value="include"]').setValue()
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ editions: "true", limit: "10" })
    expect(router.currentRoute.value.query.start).toBeUndefined()

    router.back()
    await flushPromises()
    expect(checkedMode()).toBe("only")
    expect(router.currentRoute.value.query).toMatchObject({ editions: "only", limit: "30", start: "20" })
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=only")

    router.forward()
    await flushPromises()
    expect(checkedMode()).toBe("include")
    expect(router.currentRoute.value.query.editions).toBe("true")
  })

  it("keeps edition selection available when the search has no results", async () => {
    fetchMock.mockImplementation(() => searchResponse(0))
    const { wrapper } = await mountSearchView()

    expect(wrapper.find('.edition-mode input[value="exclude"]').exists()).toBe(true)
    expect(wrapper.find(".search-result-actions__more-actions").exists()).toBe(false)
  })
})
