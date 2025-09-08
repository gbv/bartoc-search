<template>
  <div class="no-results__wrapper">
    <div class="no-results__hero">
      <div class="no-results__hero-text">
        There are no results matching  <span v-if="searchTerm">“{{ searchTerm }}”</span>.
      </div>
    </div>
    
   
    <div class="no-results__tips">
      <h2>Suggestions:</h2>
      <ul>
        <li>Check spelling or use fewer words.</li>
        <li>Remove or change filters (language, DDC, API…)</li>
        <li>Use broader terms (e.g., “film” instead of “documentary”).</li>
        <li>Sort by <code>relevance</code> instead of <code>title</code>.</li>
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

const searchTerm = computed(() => {
  return props.search ? `for "${props.search}"` : ""
})  

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

.no-results__hero-text {
 text-align: left;
}

.no-results__tips { 
  padding-top: 32px;
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
