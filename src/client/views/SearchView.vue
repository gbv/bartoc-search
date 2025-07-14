<script setup>
import { ref, computed } from "vue"
import { useRouter } from "vue-router"
import VocabularyCard from "../components/VocabularyCard.vue"
import SearchBar from "../components/SearchBar.vue"
import NavBreadcrumb from "../components/NavBreadcrumb.vue"

const router = useRouter()
const results = ref({docs: [], numFound: 0})
const loading = ref(true)
const errorMessage = ref(null)


// Computed summary for breadcrumb data
const summary = computed(() => ({
  from: 1,
  to: results.value.docs.length,
  total: results.value.numFound,
}))

async function fetchResults(query) {
  loading.value = true
  errorMessage.value = null

  try {
    const params = new URLSearchParams(query)
    const res = await fetch(`${import.meta.env.BASE_URL}api/search?${params}`)
    if (res.ok) {
      const resp = (await res.json()).response || {}
      // Ensure docs is always an array of objects
      const docs = Array.isArray(resp?.docs)
        ? resp.docs.filter(doc => doc && typeof doc === "object")
        : []

      const numFound = resp?.numFound || 0
      results.value = { docs, numFound}
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
  router.push({ name: "search", query })
  fetchResults(query)
}
</script>

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
        v-for="doc in results.docs"
        :key="doc.id"
        :doc="doc" />
    </section>
  </section>
</template>
