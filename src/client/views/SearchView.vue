<template>
  <NavBreadcrumb
    v-if="summary.total > 0"
    :summary="summary" />

  <section class="search-view__wrapper">
    <SearchBar
      :search-on-mounted="true"
      @search="onSearch" />
    <div
      v-if="errorMessage"
      class="search-view__error">
      {{ errorMessage }}
    </div>
    <div
      v-else-if="loading"
      class="search-view__loading">
      Loading...
    </div>
    <section
      v-else
      class="search-view">
      <div
        v-if="results.docs.length === 0"
        class="search-view__no-results">
        No results.
      </div>
      <VocabularyCard
        v-for="doc in visibleResults"
        :key="doc.id"
        :doc="doc" />
    </section>

    <!-- Load more button -->
    <button
      v-if="visibleCount < results.numFound && loading === false"
      class="button"
      @click="loadMore">
      More results
    </button>
  </section>
</template>

<script setup>
import { ref, computed } from "vue"
import { useRouter, useRoute } from "vue-router"
import VocabularyCard from "../components/VocabularyCard.vue"
import SearchBar from "../components/SearchBar.vue"
import NavBreadcrumb from "../components/NavBreadcrumb.vue"


// Router hooks
const router = useRouter()
const route = useRoute()

// Pagination settings
const pageSize = 10

// Single request: fetch all matching docs up to Solr limit (max 10000)
const maxLimit = 10000

// Controls how many to show
const visibleCount = ref(Number(route.query.maxShownItems) || pageSize)
// Derived visible slice
const visibleResults = computed(() =>
  results.value.docs.slice(0, visibleCount.value),
)

const results = ref({docs: [], numFound: 0})

const loading = ref(true)
const errorMessage = ref(null)


// Computed summary for breadcrumb data
const summary = computed(() => ({
  from: 1,
  to: visibleCount.value,
  total: results.value.numFound,
}))

async function fetchResults(query) {
  loading.value = true
  errorMessage.value = null

  try {
    const params = new URLSearchParams(query)
    const res = await fetch(`${import.meta.env.BASE_URL}api/search?${params}&limit=${maxLimit}`)
    if (res.ok) {
      const resp = (await res.json()).response || {}
      // Ensure docs is always an array of objects
      const docs = Array.isArray(resp?.docs)
        ? resp.docs.filter(doc => doc && typeof doc === "object")
        : []

      const numFound = resp?.numFound || 0
      results.value = { docs, numFound}
      // reset visibleCount if needed
      visibleCount.value = Number(route.query.maxShownItems) || pageSize
    } else {
      throw new Error(`Response status: ${res.status}`)
    }
  } catch (error) {
    errorMessage.value = `Search failed: ${error.message}`
  } finally {
    loading.value = false
  }
}

function onSearch(query) {
  // Reset to default page size
  visibleCount.value = pageSize
  // Build query params: always include search
  const queryParams = new URLSearchParams(route.query)
  // Only include maxShownItems if different from default
  if (visibleCount.value !== pageSize) {
    queryParams.maxShownItems = visibleCount.value
  }

  router.push({ name: "search", query })
  fetchResults(query)
}

// Load more results by increasing visible results
function loadMore() {
  visibleCount.value = Math.min(
    visibleCount.value + pageSize,
    results.value.numFound,
  )
  router.push({ name: "search", query: { ...route.query, maxShownItems: visibleCount.value } })
}

</script>


