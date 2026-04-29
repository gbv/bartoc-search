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
      :key="doc.id" 
      class="result-card-wrapper">
      <VocabularyCard  
        :doc="doc" 
        :sort="sortBy" />
    </div>
    
    <!-- Result actions -->
    <div
      v-if="results.docs.length > 0"
      class="search-results__actions">
      <button
        v-if="results.docs.length < results.numFound && !loading"
        class="button result-action__button load-more__button"
        type="button"
        @click="$emit('load-more')">
        More results
      </button>

      <a
        v-if="downloadUrl"
        class="button result-action__button download-results__button"
        :href="downloadUrl"
        download="bartoc-search-results.jskos.json"
        type="application/json">
        Download Results
      </a>
    </div>
  </section>
</template>


<script setup>
import { toRefs, ref, watch, nextTick } from "vue"
import VocabularyCard from "../components/VocabularyCard.vue"

const props = defineProps({
  results: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String,  default: "" },
  sort: { type: String, default:"" },
  downloadUrl: { type: String, default: "" },
})

// unwrap props into reactive refs
const { results, loading, errorMessage, sort: sortBy, downloadUrl } = toRefs(props)


// Declare emits for load more event
defineEmits([ "load-more" ])

// store DOM nodes for each rendered card
const cardElements = ref([]) // HTMLElement[]

function setItemRef (el, i) {
  if (el) {
    cardElements.value[i] = el
  } else {
    // When element is unmounted, remove from array
    cardElements.value.splice(i, 1)
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
    const firstNewCard = cardElements.value[oldLen]
    firstNewCard?.scrollIntoView({ behavior: "smooth", block: "start" })
  },
  { flush: "post" },
)

</script>

<style scoped>
.search-results__actions {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  margin: 2rem 0;
}

.result-action__button {
  margin: 0;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.load-more__button {
  grid-column: 2;
  justify-self: center;
}

.download-results__button {
  grid-column: 3;
  justify-self: end;
}

.search-results__actions a.button,
.search-results__actions a.button:hover,
.search-results__actions a.button:focus {
  color: var(--color-button-text, var(--color-text-dark-1));
  text-decoration: none;
}
.result-card-wrapper {
  scroll-margin-top: 80px;
}
</style>
