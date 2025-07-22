<template>
  <NavBreadcrumb
    v-if="summary.total > 0"
    :summary="summary" />

  <section class="search-view__wrapper">
    <SearchBar
      :search-on-mounted="true"
      @search="onSearch" />
    <SearchControls
      :model-value="sortKey"
      @sort="onSort" />
    <SearchResults
      :results="results"
      :loading="loading"
      :error-message="errorMessage"
      :sort="sortBy"
      @load-more="loadMore" />
  </section>
</template>

<script setup>
import { ref, computed } from "vue"
import { useRouter, useRoute } from "vue-router"
import SearchBar from "../components/SearchBar.vue"
import NavBreadcrumb from "../components/NavBreadcrumb.vue"
import SearchControls from "../components/SearchControls.vue"
import SearchResults from "../components/SearchResults.vue"

// Router hooks
const router = useRouter()
const route = useRoute()

// Pagination settings
const pageSize = 10
// drive everything off this `limit`
const limit = ref(Number(route.query.limit) || pageSize)

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

    const resp = (await res.json()).response || {}
    // Ensure docs is always an array of objects
    const docs = Array.isArray(resp?.docs)
      ? resp.docs.filter(doc => doc && typeof doc === "object")
      : []

    const numFound = resp?.numFound || 0
    results.value = { docs, numFound}

    // sync the URL
    router.replace({
      name: route.name,
      query: { 
        ...query,
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
  }
  router.push({ name: "search", query: newQuery })
  fetchResults(newQuery)
}

</script>


