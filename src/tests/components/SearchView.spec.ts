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

async function mountSearchView() {
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

  await router.push({ name: "search", query: { search: "first", limit: "10" } })
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
          props: ["includeEditions"],
          emits: ["update:includeEditions"],
          template: `
            <input
              class="test-include-editions"
              type="checkbox"
              :checked="includeEditions"
              @change="$emit('update:includeEditions', $event.target.checked)">
          `,
        },
        SearchResultActions: {
          emits: ["load-more", "show-all"],
          props: ["canLoadMore"],
          template: `
            <button
              v-if="canLoadMore"
              class="test-load-more"
              type="button"
              @click="$emit('load-more')">
              More
            </button>
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
  it("keeps the edition inclusion setting in the route and API request", async () => {
    const { push, wrapper } = await mountSearchView()
    const checkbox = wrapper.get(".test-include-editions")

    expect((checkbox.element as HTMLInputElement).checked).toBe(false)

    await checkbox.setValue(true)
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      name: "search",
      query: expect.objectContaining({
        editions: "true",
        limit: "10",
      }),
    })
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(
      "editions=true",
    )
  })

})
