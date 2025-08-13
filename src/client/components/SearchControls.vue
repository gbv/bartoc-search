<template>
  <div class="search-controls__wrapper">
    <!-- Sort dropdown -->
    <form
      class="search-sort"
      @submit.prevent>
      <label for="sort">Sort by</label>
      <select
        id="sort"
        v-model="selectedSort"
        class="form-control form-select"
        @change="onChange">
        <option
          v-for="opt in options"
          :key="opt.key"
          :value="opt.key">
          {{ opt.label }}
        </option>
      </select>
    </form>
    <LookupHint
      v-if="lookupUri"
      :uri="lookupUri.uri"
      :name="lookupUri.name" />
  </div>
</template>

<script setup lang="js">
import { ref, watch, computed } from "vue"
import LookupHint from "./LookupHint.vue"

// Sort options 
const options = [
  { key: "relevance",    label: "Relevance" },
  { key: "created desc", label: "Created least" },
  { key: "created asc",  label: "Created first" },
  { key: "modified desc",label: "Modified least" },
  { key: "modified asc", label: "Modified first" },
  { key: "title asc",    label: "Title (A–Z)" },
  { key: "title desc",   label: "Title (Z–A)" },
]

const sortObj = {
  relevance: {sort: "relevance", order: "desc"},
  "created desc": {sort: "created", order: "desc"},
  "created asc": {sort: "created", order: "asc"},
  "modified desc": {sort: "modified", order: "desc"},
  "modified asc": {sort: "modified", order: "asc"},
  "title asc": {sort: "title", order: "asc"},
  "title desc": {sort: "title", order: "desc"},
}


// Single v-model binding: the selected option key (e.g. "created desc")
const props = defineProps({
  modelValue: {
    type: String,
    default: "relevance",
  },
  lookupUri:{ 
    type: Object, 
    default: null },
})


const emit = defineEmits(["sort"])

// Internal ref to track selection
const selectedSort = ref(props.modelValue)
const lookupUri = computed(() => props.lookupUri)

// whenever the parent changes modelValue, update the local state
watch(
  () => props.modelValue,
  newVal => {
    selectedSort.value = newVal
  },
)

function onChange() {
  if (!selectedSort.value) {
    selectedSort.value = "relevance"
  }

  const sortValue = { sort: sortObj[selectedSort.value].sort, 
    order: sortObj[selectedSort.value].order || "asc" }
    
  emit("sort", sortValue)
}

</script>