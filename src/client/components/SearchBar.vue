<template>
  <div>
    <input
      v-model="search"
      type="text"
      placeholder="Search terminology..."
      @keydown.enter="onSearch">
    <select v-model="field">
      <option value="">
        All fields
      </option>
      <option value="title_search">
        Title
      </option>
      <option value="publisher_label">
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
import { ref, onMounted } from "vue"
import { useRoute } from "vue-router"

/**
 * @type {{ searchOnMounted: boolean }}
 */
const props = defineProps({
  searchOnMounted: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["search"])

const route = useRoute()
const search = ref(route.query.search?.toString() || "")
const field = ref(route.query.field?.toString())

async function onSearch() {
  const query = { search: search.value.trim() }
  if (field.value) {
    query.field = field.value
  }
  emit("search", query)
}

if (props.searchOnMounted) {
  onMounted(onSearch)
}
</script>
