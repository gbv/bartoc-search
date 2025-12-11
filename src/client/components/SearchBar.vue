<template>
  <div class="search-bar__wrapper">
    <input
      v-model="search"
      type="text"
      placeholder="Search terminology..."
      @input="lookupUri"
      @keydown.enter="onSearch">
    <select v-model="field">
      <option value="">
        All fields
      </option>
      <option value="title_search">
        Title
      </option>
      <option value="publisher_en">
        Publisher
      </option>
    </select>
    <button
      class="button" 
      @click="onSearch">
      Search
    </button>
  </div>
</template>

<script setup lang="js">
import { ref, onMounted, inject } from "vue"
import { useRoute } from "vue-router"
const namespaces = inject("namespaces")

/**
 * @type {{ searchOnMounted: boolean }}
 */
const props = defineProps({
  searchOnMounted: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["search", "lookupUri"])

const route = useRoute()
const search = ref(route.query.search?.toString() || "")
const field = ref(route.query.field?.toString() || "")
const limit = ref(route.query.limit?.toString() || "10")

async function onSearch() {
  const query = { search: search.value.trim() }
  if (field.value) {
    query.field = field.value
  }
  if (limit.value) {
    query.limit = limit.value
  } 
  
  emit("search", query)
}

if (props.searchOnMounted) {
  onMounted(onSearch)
}


function lookupUri() {
  const q = (search.value || "").trim()
  if (!isHttpUrl(q)) {
    return emit("lookupUri", {})
  }

  const name = namespaces?.lookup?.(q)
  return emit("lookupUri", name ? { uri: q, name } : {})

}

const isHttpUrl = (v) => {
  if (typeof v !== "string") {
    return false
  }
  try {
    const u = new URL(v.trim())
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false 
  }
}

</script>

<style>

</style>
