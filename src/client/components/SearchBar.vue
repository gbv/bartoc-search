<template>
  <div>
    <input
      v-model="search"
      @keydown.enter="onSearch"
      type="text"
      placeholder="Search terminology..."
    />
    <select v-model="field">
      <option value="">All fields</option>
      <option value="title_search">Title</option>
      <option value="publisher_label">Publisher</option>
    </select>
    <button @click="onSearch">Search</button>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue'
  import { useRoute } from 'vue-router'

  const emit = defineEmits(["search"])
  const { searchOnMounted } = defineProps(['searchOnMounted'])

  const route = useRoute()
  const search = ref(route.query.search?.toString() || '')
  const field = ref(route.query.field?.toString())
  
  async function onSearch() {
    const query = { search: search.value.trim() }
    if (field.value) {
      query.field = field.value
    }
    emit("search", query)
  }

  if (searchOnMounted) {
    onMounted(onSearch)
  }
</script>
  
