<template>
  <div 
    v-if="!loading && !errorMessage"
    class="sidebar">
    <div class="facets__wrapper">
      <div
        v-for="field in Object.keys(FACET_FIELD_LABELS)"
        :key="field"
        class="facet-group">
        <FacetGroup
          :field="field"
          :values="facets[field] || []"
          :selected="state.activeFilters[field] || []"
          :open="state.openGroups[field] || false"
          @toggle="toggleGroup(field)"
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

const emit = defineEmits(["update-filters"])
const { facets, loading, errorMessage } = toRefs(props)

function updateFilters(field, values) {
  // optional: let the parent be the single source of truth; remove this line if you prefer lifting state
  updateFilter(field, values)

  const hasValues = Array.isArray(values) && values.length > 0
  if (hasValues) {
    // values selected → normal filter update
    emit("update-filters", { [field]: values })
  } else {
    // no values → ask backend for full bucket of this facet
    emit("update-filters", {}, { bucketFor: field })
  }
}

</script>

<style scoped>
.sidebar {
  padding: 1rem;
  width: 400px;
}
.facet-group {
  display: block;
  margin-bottom: 1rem;
  padding-left: 0;
  color: black
}
</style>
