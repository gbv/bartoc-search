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
        docs: [
          {
            id: "http://bartoc.org/en/node/1",
            title_en: "Example vocabulary",
          },
        ],
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
        SearchControls: {
          props: ["editionMode"],
          emits: ["update:editionMode"],
          template: `
            <select class="test-edition-select" :value="editionMode" @change="$emit('update:editionMode', $event.target.value)">
              <option value="exclude">Exclude</option>
              <option value="include">Include</option>
              <option value="only">Only</option>
            </select>
          `,
        },
        SearchResultActions: {
          emits: ["load-more", "show-all", "sort"],
          props: ["canLoadMore", "downloadUrl", "summary", "sortKey", "showSort"],
          template: `
            <div>
            <button
              v-if="canLoadMore"
              class="test-load-more"
              type="button"
              @click="$emit('load-more')">
              More
            </button>
            <a class="test-download" :href="downloadUrl">Download</a>
            </div>
          `,
        },
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

    await wrapper.get(".test-load-more").trigger("click")
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
    const select = wrapper.get(".test-edition-select")

    expect((select.element as HTMLSelectElement).value).toBe("exclude")

    await select.setValue("include")
    await flushPromises()

    expect(router.currentRoute.value.query.editions).toBe("true")
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=true")

    await select.setValue("only")
    await flushPromises()
    expect(router.currentRoute.value.query.editions).toBe("only")
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=only")
    expect(wrapper.get(".test-download").attributes("href")).toContain("editions=only")

    await select.setValue("exclude")
    await flushPromises()
    expect(router.currentRoute.value.query.editions).toBeUndefined()
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).not.toContain("editions=")
  })

  it("restores an editions-only URL on reload and browser navigation", async () => {
    const { router, wrapper } = await mountSearchView({ editions: "only", limit: "30", start: "20" })
    const select = wrapper.get(".test-edition-select")

    expect((select.element as HTMLSelectElement).value).toBe("only")
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=only")

    await select.setValue("include")
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ editions: "true", limit: "10" })
    expect(router.currentRoute.value.query.start).toBeUndefined()

    router.back()
    await flushPromises()
    expect((select.element as HTMLSelectElement).value).toBe("only")
    expect(router.currentRoute.value.query).toMatchObject({ editions: "only", limit: "30", start: "20" })
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("editions=only")

    router.forward()
    await flushPromises()
    expect((select.element as HTMLSelectElement).value).toBe("include")
    expect(router.currentRoute.value.query.editions).toBe("true")
  })

})
