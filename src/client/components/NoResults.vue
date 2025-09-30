<template>
  <div
    class="no-results"
    role="status"
    aria-live="polite">
    <div class="no-results-message">
      <div>
        There are no results <span v-if="term">for “{{ term }}”</span>
        <span v-if="activeCount">with {{ activeCount }} active filter{{ activeCount>1?'s':'' }}</span>.
      </div>
    </div>
    <div v-if="term || hasFilters">
      <h2>Suggestions:</h2>
      <ul>
        <li v-if="term">
          Check spelling or use fewer words for the query “{{ term }}”.
        </li>
        <li v-if="term">
          Use broader terms (e.g., “film” instead of “documentary”).
        </li>
        <li v-if="hasFilters">
          <a
            href="javascript:false;"
            @click="emit('clear-filters')">Clear active filters</a>
          then refine your search.
        </li>
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

<style>
.no-results { 
  display: flex;
  flex-direction: column;
  text-align: left; 
  color: var(--color-text);
}
.no-results-message { 
  font-size: 1.5em; 
  padding: 1em;
}
.no-results h2 {
  margin-bottom: 0;
  font-size: 1.2em;
}
</style>
