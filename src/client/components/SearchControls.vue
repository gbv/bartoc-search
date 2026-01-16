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
      class="search-filters">
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

import { state } from "../stores/filters.js"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"
import {
  SORT_OPTIONS,
  SORT_KEY_TO_SOLR,
  DEFAULT_SORT_KEY,
} from "../constants/sort.js"


// Sort options 
const options = SORT_OPTIONS

// Single v-model binding: the selected option key (e.g. "created desc")
const props = defineProps({
  modelValue: {
    type: String,
    default: DEFAULT_SORT_KEY,
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
    const facetMeta   = FACET_FIELD_LABELS[internal] || {}
    const facetLabel  = facetMeta.label ?? internal
    const valueLabels = facetMeta.values || {}

    ;(values || []).forEach(v => {
      items.push({
        key: `${internal}|${v}`,
        internal,
        label: facetLabel,
        value: valueLabels[v] ?? (v === "-" ? "no value" : v),
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
    selectedSort.value = DEFAULT_SORT_KEY
  }

  const sortValue = SORT_KEY_TO_SOLR[selectedSort.value] || SORT_KEY_TO_SOLR[DEFAULT_SORT_KEY]    
  emit("sort", { sort: sortValue.sort, order: sortValue.order })
}

function onRemoveBadge(badge) {
  emit("remove-badge", { field: badge.internal, value: badge.display })
}

</script>
