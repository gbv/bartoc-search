<template>
    <div class="w-full max-w-xl space-y-4">
      <!-- Search Input -->
      <div class="flex items-center space-x-2">
        <input
          v-model="query"
          @keydown.enter="onSearch"
          type="text"
          placeholder="Search terminology..."
          class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

         <!-- Dropdown -->
        <select v-model="selectedField" class="border rounded px-2 py-1">
          <option value="allfields">All fields</option>
          <option value="title_search">Title</option>
          <option value="publisher_label">Publisher</option>
        </select>

        <button
          @click="onSearch"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Search
        </button>
      </div>
  
      <!-- Feedback messages -->
      <div v-if="loading" class="text-gray-500">Loading results...</div>
      <div v-if="!loading && results.length === 0 && hasSearched" class="text-red-500">No results found.</div>

      <VocabularyCard v-for="doc in results || []" :key="doc.id" :doc="doc" />

    </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import axios from 'axios'
  import VocabularyCard from './VocabularyCard.vue'
  
  const query = ref('')
  const results = ref<any[]>([])
  const loading = ref(false)
  const hasSearched = ref(false)
  const selectedField = ref('allfields')
  
  async function onSearch() {
    const q = query.value.trim()
    if (!q) return
    const field = selectedField.value;
    loading.value = true
    hasSearched.value = true

    try {
        // Call to bartoc-etl backend
      const res = await axios.get(`http://localhost:3000/search`, {
        params: { q, field },
      })
      results.value = res.data.response.docs || []
      console.log(res.data.response.numFound);
    } catch (error) {
      console.error('Search failed:', error)
      results.value = []
    } finally {
      loading.value = false
    }
  }
</script>
  