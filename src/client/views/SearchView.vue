<template>
  <NavBreadcrumb
    v-if="summary.total > 0"
    :summary="summary" />

  <section class="search-view__wrapper">
    <SearchBar
      class="search-bar__area"
      :search-on-mounted="true"
      @search="onSearch" />
    <SearchControls
      class="search-controls__area"
      :model-value="sortKey"
      @sort="onSort" />
    <SearchResults
      class="search-results__area"
      :results="results"
      :loading="loading"
      :error-message="errorMessage"
      :sort="sortBy"
      @load-more="loadMore" />
    <aside class="search-sidebar__area">
      <SearchSidebar
        :facets="results.facets || {}"
        :loading="loading"
        @update-filters="onFilterChange" />
    </aside>
  </section>
</template>

<script setup>
import { ref, computed } from "vue"
import { useRouter, useRoute } from "vue-router"
import SearchBar from "../components/SearchBar.vue"
import NavBreadcrumb from "../components/NavBreadcrumb.vue"
import SearchControls from "../components/SearchControls.vue"
import SearchResults from "../components/SearchResults.vue"
import SearchSidebar from "../components/SearchSidebar.vue"
import _ from "lodash"
import { state, setFilters, resetFiltersRequested, clearFilters, resetOpenGroups } from "../stores/filters.js"

// Router hooks
const router = useRouter()
const route = useRoute()

// Pagination settings
const pageSize = 10
// drive everything off this `limit`
const limit = ref(Number(route.query.limit) || pageSize)
const activeFilters = state.activeFilters

// results & state
const results = ref({ docs: [], numFound: 0 })
const loading = ref(true)
const errorMessage = ref(null)
const sortBy = ref()

// Computed summary for breadcrumb data
const summary = computed(() => ({
  from: 1,
  to: results.value.docs.length,
  total: results.value.numFound,
}))

// derive the select-option key from the route
const sortKey = computed(() => {
  const s = route.query.sort || "relevance"
  // relevance is a special one–word case
  if (s === "relevance") {
    return "relevance"
  }
  const o = (route.query.order || "asc").toLowerCase()
  return `${s} ${o}`
})

function cleanQuery(query) {
  const { filters, ...newQuery } = query

  const parsed = filters ? JSON.parse(filters) : {}

  const kept = _.pickBy(parsed, v => _.isArray(v) && v.length > 0)

  return _.isEmpty(kept)
    ? newQuery
    : { ...newQuery, filters: JSON.stringify(kept) }
}

async function fetchResults(query) {
  loading.value = true
  errorMessage.value = null

  try {
    const params = new URLSearchParams({
      ...query,
      start: 0,
      rows: String(limit.value),
    })

    const res = await fetch(`${import.meta.env.BASE_URL}api/search?${params}`)

    if (!res.ok) {
      throw new Error(`Status ${res.status}`)
    }

    const data = (await res.json()) || {}

    const response = data.response 
    // Ensure docs is always an array of objects
    const docs = Array.isArray(response?.docs)
      ? response.docs.filter(doc => doc && typeof doc === "object")
      : []


    const numFound = response?.numFound || 0
    const facets = data?.facets || {}
    
    // After (only update docs & numFound, and merge facets):
    results.value.docs      = docs
    results.value.numFound  = numFound
    results.value.facets = facets

    // Clean up query filters
    const cleanedQuery = cleanQuery(query)

    // sync the URL
    router.replace({
      name: route.name,
      query: { 
        ...cleanedQuery,
        limit: String(limit.value),
      },
    })

  } catch (error) {
    errorMessage.value = `Search failed: ${error.message}`
  } finally {
    loading.value = false
  }
}

function onSearch(query) {
  limit.value = pageSize
  resetFiltersRequested()
  clearFilters()
  resetOpenGroups()
  fetchResults(query, { append: false })
}

function onSort({ sort, order }) {
  sortBy.value = sort
  
  // merge sort/order into whatever the user is currently searching for
  const baseQuery = { ...route.query }
  const newQuery = {
    ...baseQuery,
    sort,
    order,
    filters: JSON.stringify(activeFilters),
  }

  router.push({ name: "search", query: newQuery })
  fetchResults(newQuery)
}

// Load more results by increasing visible results
function loadMore() {

  let newLimit = limit.value += pageSize

  if (results.value.numFound < newLimit) {
    newLimit = results.value.numFound
  }

  const baseQuery = { ...route.query }
  const newQuery = {
    ...baseQuery,
    limit: newLimit,
    filters: JSON.stringify(activeFilters),
  }
  router.push({ name: "search", query: newQuery })
  fetchResults(newQuery)
}

function onFilterChange(filters) {
  limit.value = pageSize
  setFilters({ ...activeFilters, ...filters })
  const newQuery = { ...route.query, filters: JSON.stringify(activeFilters)}
  fetchResults(newQuery)
}

</script>

<style scoped>
.search-view__wrapper  {
  display: grid;
  grid-column-gap: 30px;
  grid-template-areas: "search-bar search-bar" 
  "search-controls search-controls"
  "results sidebar";
  margin: 0 auto;
}

.search-bar__area { grid-area: search-bar; }
.search-results__area    { grid-area: results; }
.search-controls__area   { grid-area: search-controls; }
.search-sidebar__area    { grid-area: sidebar; }

</style>



