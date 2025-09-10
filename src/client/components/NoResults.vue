<template>
  <div
    class="no-results__wrapper"
    role="status"
    aria-live="polite">
    <div class="no-results__hero">
      <div class="no-results__hero-text">
        There are no results matching  <span v-if="term">“{{ term }}”</span>
        <span v-if="activeCount">with {{ activeCount }} active filter{{ activeCount>1?'s':'' }}</span>.
      </div>
    </div>

    <div class="no-results__actions">
      <button
        v-if="hasFilters"
        class="button"
        title="Remove all active filters"
        @click="emit('clear-filters')">
        Clear filters
      </button>
    </div>
    
    <div class="no-results__tips">
      <h2>Suggestions:</h2>
      <ul>
        <li>Check spelling or use fewer words for the query <span v-if="term">“{{ term }}”</span>.</li>
        <li v-if="hasFilters">
          Clear active filters with the button above, then refine your search.
        </li>
        <li>Use broader terms (e.g., “film” instead of “documentary”).</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue"

const props = defineProps({
  search: { type: String, default: "" },
  activeFilters: { type: Object, default: () => ({}) },
})

const emit = defineEmits(["clear-filters"])

const term = computed(() => (props.search || "").trim())
const activeCount = computed(
  () => Object.values(props.activeFilters).filter(v => Array.isArray(v) && v.length).length,
)
const hasFilters = computed(() => activeCount.value > 0)

</script>

<style scoped>
.no-results__wrapper { 
  color: #1f2937;
  display: flex;
  flex-direction: column;
  padding-top: 32px;
}

.no-results__hero { 
  font-size: 24px; 
  padding: 24px;
  background-color: #cfd1d1d0;
  border-left: 4px solid #961300;
}

.no-results__actions { 
  padding-top: 24px;
  display: flex;
}

.no-results__hero-text {
 text-align: left;
}

.no-results__tips { 
  text-align: left; 
}
.no-results__tips h3 { 
  font-size: 14px; 
  margin: 10px 0; 
  color: #111827; 
}
.no-results__tips ul { 
  margin: 0; 
  padding-left: 16px; 
  color: #374151; 
}
.no-results__tips code { 
  background: #f3f4f6; 
  border-radius: 4px; 
  padding: 0 4px; 
}
</style>
