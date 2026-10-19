<template>
  <nav
    aria-label="Search result actions"
    class="search-result-actions">
    <div class="search-result-actions__toolbar">
      <form
        v-if="showSort"
        class="search-result-actions__sort noprint"
        @submit.prevent>
        <label :for="sortSelectId">
          <span class="search-result-actions__sort-label-desktop">Sort by</span>
          <span class="search-result-actions__sort-label-mobile">Sort:</span>
        </label>
        <select
          :id="sortSelectId"
          :value="sortKey"
          class="cc-form-control search-result-actions__sort-select"
          @change="onSortChange">
          <option
            v-for="opt in sortOptions"
            :key="opt.key"
            :value="opt.key">
            {{ opt.label }}
          </option>
        </select>
      </form>

      <div class="action-group search-result-actions__buttons noprint">
        <button
          v-if="canLoadMore"
          class="cc-button cc-button-primary search-result-actions__button"
          type="button"
          @click="emit('load-more')">
          More
        </button>
        <button
          v-if="canLoadMore"
          class="cc-button cc-button-primary search-result-actions__button search-result-actions__all"
          type="button"
          @click="emit('show-all')">
          All
        </button>
        <button
          class="cc-button cc-button-primary search-result-actions__button search-result-actions__print"
          type="button"
          @click="printPage">
          Print
        </button>
        <a
          v-if="downloadUrl"
          class="cc-button cc-button-primary search-result-actions__button search-result-actions__download"
          :href="downloadUrl"
          download="bartoc-search-results.jskos.json"
          type="application/json">
          Download
        </a>
      </div>
    </div>

    <span class="search-result-actions__summary">
      {{ formattedSummary }}
    </span>
  </nav>
</template>

<script setup>
import { computed, useId } from "vue"
import {
  DEFAULT_SORT_KEY,
  SORT_KEY_TO_SOLR,
  SORT_OPTIONS,
} from "../constants/sort.js"

const props = defineProps({
  summary: {
    type: Object,
    required: true,
    validator(summary) {
      return (
        Number.isInteger(summary.from) &&
        Number.isInteger(summary.to) &&
        Number.isInteger(summary.total)
      )
    },
  },
  canLoadMore: {
    type: Boolean,
    default: false,
  },
  downloadUrl: {
    type: String,
    default: "",
  },
  sortKey: {
    type: String,
    default: DEFAULT_SORT_KEY,
  },
  showSort: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits([ "load-more", "show-all", "sort" ])
const sortOptions = SORT_OPTIONS
const sortSelectId = `search-result-actions-sort-${useId()}`

const formattedSummary = computed(() => {
  const { from, to, total } = props.summary
  const formatNumber = num => new Intl.NumberFormat().format(num)

  return `Showing ${formatNumber(from)} - ${formatNumber(to)} of ${formatNumber(total)} results`
})

function onSortChange(event) {
  const key = event.target.value || DEFAULT_SORT_KEY
  const sortValue = SORT_KEY_TO_SOLR[key] || SORT_KEY_TO_SOLR[DEFAULT_SORT_KEY]

  emit("sort", { sort: sortValue.sort, order: sortValue.order })
}

function printPage() {
  if (typeof window === "undefined" || typeof window.print !== "function") {
    return
  }

  const body = window.document?.body
  const cleanupPrintMode = () => {
    body?.classList.remove("print-search-results")
  }
  const unregisterPrintCleanup = () => {
    window.removeEventListener?.("afterprint", cleanupPrintMode)
  }

  body?.classList.add("print-search-results")
  window.addEventListener?.("afterprint", cleanupPrintMode, { once: true })

  try {
    window.print()
  } catch (error) {
    cleanupPrintMode()
    unregisterPrintCleanup()
    throw error
  }
}
</script>

<style scoped>
.search-result-actions {
  display: flex;
  flex-direction: column;
  gap: var(--cc-space-xs);
  width: 100%;
  margin: var(--cc-space-sm) 0;
}

.search-result-actions__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--cc-space-sm);
}

.search-result-actions__summary {
  font-size: var(--cc-font-size-sm);
  font-weight: var(--cc-font-weight-regular);
  color: var(--cc-color-muted);
}

.search-result-actions__sort {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--cc-space-sm);
}

.search-result-actions__sort label {
  color: var(--cc-color-text);
  font-size: var(--cc-font-size-sm);
}

.search-result-actions__sort-label-mobile {
  display: none;
}

.search-result-actions__sort-select {
  width: auto;
  min-width: 12rem;
}

.search-result-actions__buttons {
  justify-content: flex-end;
  margin-left: auto;
}

.search-result-actions__button {
  margin: 0;
}

@media (max-width: 767px) {
  .search-result-actions {
    margin: var(--cc-space-sm) 0;
    gap: var(--cc-space-xs);
  }

  .search-result-actions__toolbar {
    justify-content: flex-start;
    align-items: center;
    gap: var(--cc-space-sm);
  }

  .search-result-actions__summary {
    order: -1;
  }

  .search-result-actions__sort {
    flex: 0 1 auto;
    flex-wrap: nowrap;
    gap: var(--cc-space-xs);
  }

  .search-result-actions__sort-label-desktop {
    display: none;
  }

  .search-result-actions__sort-label-mobile {
    display: inline;
  }

  .search-result-actions__buttons {
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-left: 0;
  }

  .search-result-actions__all,
  .search-result-actions__print,
  .search-result-actions__download {
    display: none;
  }
}

@media print {
  .search-result-actions {
    display: block;
    margin: 0 0 var(--cc-space-xs);
  }
}
</style>
