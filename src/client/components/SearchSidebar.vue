<template>
  <div
    v-if="!errorMessage"
    class="sidebar">
    <div class="facets__wrapper">
      <div
        v-for="field in Object.keys(FACET_FIELD_LABELS)"
        :key="field"
        class="facet-group"
        :class="{ 'facet-group--open': state.openGroups[field] }">
        <FacetGroup
          :field="field"
          :values="facets[field] || []"
          :selected="state.activeFilters[field] || []"
          :open="state.openGroups[field] || false"
          @toggle="toggleGroup(field)"
          @modal-toggle="open => emit('modal-toggle', open ? field : null)"
          @change="val => updateFilters(field, val)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { toRefs } from "vue"
import FacetGroup from "./FacetGroup.vue"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"
import { state, updateFilter, toggleGroup } from "../stores/filters.js"


const props = defineProps({
  facets: { type: Object, required: true },
  loading:{ type: Boolean, default: false },
  errorMessage: { type: String,  default: "" },
})

const emit = defineEmits(["update-filters", "modal-toggle"])
const { facets, errorMessage } = toRefs(props)


function updateFilters(field, values) {
  // Did this facet have selected values before the change?
  const hadValues =
    Array.isArray(state.activeFilters[field]) &&
    state.activeFilters[field].length > 0

  // Apply the new selection to the shared store
  updateFilter(field, values)

  const hasValues = Array.isArray(values) && values.length > 0

  if (hasValues) {
    // 1) There is at least one selected value → real filter update
    emit("update-filters", { [field]: values })
  } else if (!hadValues) {
    // 2) No values before, no values now → pure “bucket open” request
    //    This is the case when the user just opens the facet.
    emit("update-filters", {}, { bucketFor: field })
  } else {
    // 3) There *were* values before and now there are none:
    //    user cleared the last filter in this facet → real search change.
    emit("update-filters", { [field]: [] }, { bucketFor: field })
  }

}

</script>

<style scoped>
.sidebar {
  padding: var(--cc-space-md);
  width: 400px;
  position: relative;
}

@media (min-width: 768px) {
  .sidebar {
    padding-top: var(--cc-space-sm);
  }
}

@media (max-width: 767px) {
  .sidebar {
    position: static;
    width: auto;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  .facets__wrapper,
  .facet-group {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
}

.facet-group {
  display: block;
  position: relative;
  border-bottom: var(--cc-border-width) solid var(--cc-border-color-control);
  color: var(--cc-color-text);
}

.facet-group--open::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: calc(var(--cc-border-width) + var(--cc-border-width-strong));
  background: var(--cc-color-primary);
  pointer-events: none;
  z-index: 1;
}

.facets__wrapper {
  background: var(--cc-color-surface);
}

.facet-group:last-child {
  border-bottom: 0;
}
</style>
