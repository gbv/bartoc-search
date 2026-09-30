<template>
  <div class="search-controls__wrapper">
    <LookupHint
      v-if="lookupUri"
      :uri="lookupUri.uri"
      :name="lookupUri.name" />

    <!-- Active filter badges -->
    <div
      v-if="filterGroups.length > 0"
      class="search-filters">
      <p class="search-filters__title">
        Active filters:
      </p>
      <div class="action-group badges__wrapper">
        <div
          v-for="group in filterGroups"
          :key="group.field"
          class="filter-group"
          role="group"
          :aria-label="group.label">
          <span class="filter-group__label">{{ group.label }}:</span>
          <FilterBadge
            v-for="badge in group.badges"
            :key="badge.key"
            :label="group.label"
            :value="badge.value"
            @remove-badge="onRemoveBadge(badge)" />
        </div>
        <button
          class="cc-button cc-button-danger noprint"
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
import { computed } from "vue"
import LookupHint from "./LookupHint.vue"
import FilterBadge from "./FilterBadge.vue"

import { state } from "../stores/filters.js"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"

const props = defineProps({
  lookupUri:{ 
    type: Object, 
    default: null },
})


const emit = defineEmits(["remove-badge", "clear-filters"])

const lookupUri = computed(() => props.lookupUri)

/**
 * Convert activeFilters ({ field: [rawValue, ...] }) into display groups.
 * Skip fields without selected values and use facet labels when available.
 * Keep each rawValue so unchecking a box removes the exact filter value.
 */
const filterGroups = computed(() => {
  return Object.entries(state.activeFilters || {}).flatMap(([field, values]) => {
    if (!values?.length) {
      return []
    }

    const facetMeta = FACET_FIELD_LABELS[field] || {}
    const valueLabels = facetMeta.values || {}

    return [{
      field,
      label: facetMeta.label ?? field,
      badges: values.map(value => ({
        key: field + "|" + value,
        field,
        value: valueLabels[value] ?? (value === "-" ? "no value" : value),
        rawValue: value,
      })),
    }]
  })
})

function onRemoveBadge(badge) {
  emit("remove-badge", { field: badge.field, value: badge.rawValue })
}

</script>

<style scoped>
.search-filters {
  padding-top: var(--cc-space-md);
}

.search-filters__title {
  margin: 0 0 var(--cc-space-xs);
  font-size: var(--cc-font-size-sm);
}

.badges__wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--cc-space-sm);
}

.filter-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--cc-space-sm);
  row-gap: var(--cc-space-xs);
  padding: var(--cc-space-xs) var(--cc-space-sm);
  border: 1px solid var(--cc-border-color);
  border-radius: var(--cc-radius-sm);
  background-color: var(--cc-color-surface-muted);
}

.filter-group__label {
  font-weight: 600;
}
</style>
