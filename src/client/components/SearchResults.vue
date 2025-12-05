<template>
  <div
    v-if="errorMessage"
    class="search-view-results__error">
    {{ errorMessage }}
  </div>
  <div
    v-else-if="loading"
    class="search-view-results__loading">
    <loading-indicator size="xl" />
  </div>
  <section
    v-else
    class="search-view-results__wrapper">
    <div
      v-if="results.docs.length === 0"
      class="search-view-results__no-results">
      No results.
    </div>
    <div
      v-for="(doc, idx) in results.docs"
      :ref="cardEl => setItemRef(cardEl, idx)"
      :key="doc.id">
      <VocabularyCard  
        :doc="doc" 
        :sort="sortBy" />
    </div>
    
    <!-- Load more button -->
    <button
      v-if="results.docs.length < results.numFound && !loading" 
      class="button load-more__button"
      @click="$emit('load-more')">
      More results
    </button>
  </section>
</template>


<script setup>
import { toRefs, ref, watch, nextTick } from "vue"
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

// store DOM nodes for each rendered card
const cardElements = ref([]) // HTMLElement[]

function setItemRef (el, i) {
  if (el) {
    cardElements.value[i] = el
  }
}

// when more results are appended, scroll to the first new one
watch(
  () => results.value.docs.length,
  async (newLen, oldLen) => {
    if (!oldLen || newLen <= oldLen) {
      return
    }
    await nextTick()
    const firstNewCard = cardElements.value[oldLen-1]
    firstNewCard?.scrollIntoView({ behavior: "smooth", block: "start" })
  },
  { flush: "post" },
)

</script>

<style scoped>
.load-more__button {
  display: block;
  margin: 2rem auto;
}
</style>
