<template>
  <div
    v-if="errorMessage"
    class="search-view-results__error">
    {{ errorMessage }}
  </div>
  <div
    v-else-if="loading"
    class="search-view-results__loading">
    Loading...
  </div>
  <section
    v-else
    class="search-view-results__wrapper">
    <div
      v-if="results.docs.length === 0"
      class="search-view-results__no-results">
      No results.
    </div>
    <VocabularyCard
      v-for="doc in results.docs"
      :key="doc.id"
      :doc="doc" 
      :sort="sortBy" />
    <!-- Load more button -->
    <button
      v-if="results.docs.length < results.numFound && !loading" 
      class="button"
      @click="$emit('load-more')">
      More results
    </button>
  </section>
</template>


<script setup>
import { toRefs } from "vue"
import VocabularyCard from "../components/VocabularyCard.vue"

const props = defineProps({
  results: { type: Object, required: true },
  loading:      { type: Boolean, default: false },
  errorMessage: { type: String,  default: "" },
  sort: { type: String, defualt:"" },
})

// unwrap props into reactive refs
const { results, loading, errorMessage, sort: sortBy } = toRefs(props)

// Declare emits for load more event
defineEmits([ "load-more" ])

</script>


