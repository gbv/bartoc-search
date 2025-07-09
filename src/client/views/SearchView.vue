<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import VocabularyCard from '../components/VocabularyCard.vue'

const route = useRoute()
const query = ref(route.query.q?.toString() || '')
const field = ref(route.query.field?.toString() || 'allfields')
const results = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const hasSearched = ref(false)

async function fetchResults() {
  loading.value = true
  errorMessage.value = null
  hasSearched.value = true

  try {
    const res = await axios.get(`${import.meta.env.BASE_URL}api/search`, {
      params: { search: query.value, field: field.value },
    })
    results.value = res.data.response.docs || []
  } catch (error) {
    errorMessage.value = 'Error during search'
  } finally {
    loading.value = false
  }
}

onMounted(fetchResults)
watch(() => route.query, fetchResults)
</script>

<template>
  <section class="search-view">
    <div v-if="loading" class="search-view__loading">Loading...</div>
    <div v-if="!loading && errorMessage" class="search-view__error">{{ errorMessage }}</div>
    <div v-if="!loading && hasSearched && results.length === 0" class="search-view__no-results">No results.</div>

    <div class="search-view__results">
      <VocabularyCard v-for="doc in results" :key="doc.id" :doc="doc" />
    </div>
  </section>
</template>
