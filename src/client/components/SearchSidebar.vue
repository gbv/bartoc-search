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
  updateFilter(field, values)
  emit("update-filters", { [field]: values })
}

</script>

<style scoped>
.sidebar {
  padding: 1rem;
  border-radius: 4px;
  width: 400px;
}
.facet-group + .facet-group {
  margin-top: 1rem;
}
.facet-group {
  display: block;
  margin-bottom: 1rem;
  padding-left: 0;
  color: black
}
</style>