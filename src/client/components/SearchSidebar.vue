// SearchSidebar.vue
<template>
  <div class="sidebar">
    <div class="facets__wrapper">
      <div
        v-for="field in Object.keys(FACET_FIELD_LABELS)"
        :key="field"
        class="facet-group">
        <FacetGroup
          :field="field"
          :values="facets[field] || []"
          :selected="activeFilters[field] || []"
          @change="val => updateFilter(field, val)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { toRefs } from "vue"
import FacetGroup from "./FacetGroup.vue"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"

const props = defineProps({
  facets: { type: Object, required: true },
  activeFilters: { type: Object, default: () => ({}) },
})

const emit = defineEmits(["update-filters"])
const { facets, activeFilters } = toRefs(props)

function updateFilter(field, values) {
  const newFilters = { ...activeFilters.value, [field]: values }
  emit("update-filters", newFilters)
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