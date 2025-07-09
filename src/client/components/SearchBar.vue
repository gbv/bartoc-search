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

    </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'

  const router = useRouter()
  const query = ref('')
  const selectedField = ref('allfields')
  
  async function onSearch() {
    const search = query.value.trim()
    const field = selectedField.value;
  
    router.push({
      name: 'search',
      query: {
        search,
        field
      },
    })

  }
</script>
  
