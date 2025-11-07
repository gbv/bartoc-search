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


    <!-- Active filter badges -->
    <div
      v-if="badges.length > 0"
      class="search-controls__badges">
      <div class="badges__wrapper">
        <FilterBadge
          v-for="badge in badges"
          :key="badge.key"
          :label="badge.label"
          :value="badge.value"
          @remove-badge="onRemoveBadge(badge)" />
        <button
          class="button"
          :aria-label="`Clear Filters`"
          type="button"
          @click="emit('clear-filters')">
          Clear Filters
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="js">
import { ref, watch, computed } from "vue"
import LookupHint from "./LookupHint.vue"
import FilterBadge from "./FilterBadge.vue"

import { state, INTERNAL_TO_PUBLIC } from "../stores/filters.js"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"



// Sort options 
const options = [
  { key: "relevance",    label: "Relevance" },
  { key: "created desc", label: "Created latest" },
  { key: "created asc",  label: "Created first" },
  { key: "modified desc",label: "Modified latest" },
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


const emit = defineEmits(["sort" ,"remove-badge", "clear-filters"])

// Internal ref to track selection
const selectedSort = ref(props.modelValue)
const lookupUri = computed(() => props.lookupUri)

// Build badge items from activeFilters { internal: [v1, v2] }
const badges = computed(() => {
  const items = []
  for (const [internal, values] of Object.entries(state.activeFilters || {})) {
    const label = INTERNAL_TO_PUBLIC?.[internal] || internal
    ;(values || []).forEach(v => {
      items.push({
        key: `${internal}|${v}`,
        internal,
        label,
        value: FACET_FIELD_LABELS[internal]?.values[v] || v,
        display: v,
      })
    })
  }
  return items
})

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

function onRemoveBadge(badge) {
  emit("remove-badge", { field: badge.internal, value: badge.display })
}

</script>
