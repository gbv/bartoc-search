<template>
  <!--
    Sidebar showing all facet groups.
    It becomes fixed when the user scrolls past its original position.
  -->
  <div 
    v-if="!errorMessage"
    ref="sidebarEl"
    :class="['sidebar', { 'sidebar--fixed': isFixed }]"
    :style="isFixed ? { top: topOffset + 'px' } : {}">
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
import { toRefs, ref, onMounted, onBeforeUnmount } from "vue"
import FacetGroup from "./FacetGroup.vue"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"
import { state, updateFilter, toggleGroup } from "../stores/filters.js"


const props = defineProps({
  facets: { type: Object, required: true },
  loading:{ type: Boolean, default: false },
  errorMessage: { type: String,  default: "" },
})

const emit = defineEmits(["update-filters"])
const { facets, errorMessage } = toRefs(props)


// --- Sticky / fixed sidebar behavior ---

// Reference to the root sidebar element in the DOM
const sidebarEl = ref(null)
// Whether the sidebar is currently fixed (true) or behaves normally in the flow (false)
const isFixed = ref(false)
// Current top offset in pixels when the sidebar is fixed
const topOffset = ref(0)
// Target top offset when fixed (distance from the top of the viewport)
const FIXED_TOP = 80
// Y-position (in page coordinates) of the sidebar in its normal layout position
const baseTop = ref(0)

// Update fixed / relative state based on current scroll position
function handleScroll() {
  const y = window.scrollY || window.pageYOffset || 0
  if (y > baseTop.value) {
    // User scrolled past the original top of the sidebar → switch to fixed
    isFixed.value = true
    // Move the sidebar down smoothly up to FIXED_TOP
    const delta = Math.min(FIXED_TOP, y - baseTop.value)
    topOffset.value = delta
  } else {
    // Above the original position → back to relative layout
    isFixed.value = false
    topOffset.value = 0
  }
}

// On mount: measure the initial position of the sidebar and install scroll listener
onMounted(() => {
  if (sidebarEl.value) {
    const rect = sidebarEl.value.getBoundingClientRect()
    
    // Convert from viewport coordinates to page coordinates
    baseTop.value = rect.top + window.scrollY
  }
  window.addEventListener("scroll", handleScroll, { passive: true })
  handleScroll()
})

// Clean up listener when component is destroyed
onBeforeUnmount(() => {
  window.removeEventListener("scroll", handleScroll)
})


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
  padding: 1rem;
  width: 400px;
  position: relative;
}
.sidebar--fixed {
  position: fixed;
  max-height: calc(100vh - 14rem);
  overflow-y: auto;
  transition: top 0.25s ease-out; 
}
.facet-group {
  display: block;
  margin-bottom: 1rem;
  padding-left: 0;
  color: black
}
</style>
