<template>
  <div class="search-controls__wrapper">
    <LookupHint
      v-if="lookupUri"
      :uri="lookupUri.uri"
      :name="lookupUri.name" />
    <div class="edition-toggle noprint">
      <label class="edition-toggle__label">
        <input
          type="checkbox"
          :checked="includeEditions"
          @change="onIncludeEditionsChange">
        <font-awesome-icon
          :icon="faCodeBranch"
          class="edition-toggle__icon"
          aria-hidden="true" />
        <span>
          <span class="edition-toggle__desktop-text">Show matching editions as separate results</span>
          <span class="edition-toggle__mobile-text">Show editions separately</span>
          <span v-if="matchingEditionCount != null"> ({{ matchingEditionCount }})</span>
        </span>
      </label>
    </div>


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
import { faCodeBranch } from "@fortawesome/free-solid-svg-icons"
import LookupHint from "./LookupHint.vue"
import FilterBadge from "./FilterBadge.vue"

import { state } from "../stores/filters.js"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"

const props = defineProps({
  lookupUri:{ 
    type: Object, 
    default: null },
  includeEditions: {
    type: Boolean,
    default: false,
  },
  matchingEditionCount: { type: Number, default: undefined },
})


const emit = defineEmits(["remove-badge", "clear-filters", "update:includeEditions"])

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
function onIncludeEditionsChange(event) {
  emit("update:includeEditions", event.target.checked)
}


</script>

<style scoped>
.edition-toggle {
  padding-top: var(--cc-space-md);
}

.edition-toggle__label {
  display: inline-flex;
  align-items: center;
  gap: var(--cc-space-xs);
}

.edition-toggle__icon {
  color: var(--cc-color-primary);
}

.edition-toggle__mobile-text {
  display: none;
}

@media (max-width: 767px) {
  .edition-toggle__desktop-text {
    display: none;
  }

  .edition-toggle__mobile-text {
    display: inline;
  }
}

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
