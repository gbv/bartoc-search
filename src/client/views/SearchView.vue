<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import VocabularyCard from '../components/VocabularyCard.vue'
import SearchBar  from '../components/SearchBar.vue'

const route = useRoute()
const search = ref(route.query.search?.toString() || '')
const field = ref(route.query.field?.toString())
const results = ref([])
const loading = ref(true)
const errorMessage = ref(null)

async function fetchResults() {
  loading.value = true
  errorMessage.value = null

  try {
    const params = new URLSearchParams()
    params.append("search", search.value)
    if (field.value) params.append("field", field.value)

    const res = await fetch(`${import.meta.env.BASE_URL}api/search?${params}`)
    if (res.ok) {
       results.value = (await res.json()).response.docs || []
    } else {
      throw new Error(`Response status: ${response.status}`) 
    }
  } catch (error) {
    errorMessage.value = `Search failed: ${error.message}`
  } finally {
    loading.value = false
  }
}

onMounted(fetchResults)
watch(() => route.query, fetchResults)
</script>

<template>
  <div>
    <SearchBar />
    <div v-if="loading" class="search-view__loading">Loading...</div>
    <div v-else-if="errorMessage" class="search-view__error">{{ errorMessage }}</div>
    <section v-else class="search-view">
      <div v-if="results.length === 0" class="search-view__no-results">No results.</div>
      <VocabularyCard v-for="doc in results" :key="doc.id" :doc="doc" />
    </section>
  </div>
</template>
