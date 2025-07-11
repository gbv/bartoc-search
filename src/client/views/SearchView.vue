<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import VocabularyCard from '../components/VocabularyCard.vue'
import SearchBar from '../components/SearchBar.vue'

const router = useRouter()
const results = ref([])
const loading = ref(true)
const errorMessage = ref(null)

async function fetchResults(query) {
  loading.value = true
  errorMessage.value = null

  try {
    const params = new URLSearchParams(query)
    const res = await fetch(`${import.meta.env.BASE_URL}api/search?${params}`)
    if (res.ok) {
       results.value = (await res.json()).response.docs || []
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
  router.push({name: 'search', query})
  fetchResults(query)
}
</script>

<template>
  <section class="search-view__wrapper">
    <SearchBar @search="onSearch" search-on-mounted="true"/>
    <div v-if="errorMessage" class="search-view__error">{{ errorMessage }}</div>
    <div v-else-if="loading" class="search-view__loading">Loading...</div>
    <section v-else class="search-view">
      <div v-if="results.length === 0" class="search-view__no-results">No results.</div>
      <VocabularyCard v-for="doc in results" :key="doc.id" :doc="doc" />
    </section>
  </section>
</template>
