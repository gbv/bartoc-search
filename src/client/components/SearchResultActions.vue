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
        <button
          v-if="showResults && canLoadMore"
          class="cc-button cc-button-primary search-result-actions__button search-result-actions__more-mobile"
          type="button"
          @click="emit('load-more')">
          More
        </button>
      </form>

      <div
        v-if="showSort"
        class="edition-mode noprint">
        <span class="edition-mode__label">Editions:</span>
        <fieldset class="edition-mode__choices">
          <legend class="cc-visually-hidden">
            Editions in search results
          </legend>
          <label
            v-for="option in editionOptions"
            :key="option.value"
            class="edition-mode__option">
            <input
              type="radio"
              :name="editionModeName"
              :value="option.value"
              :checked="editionMode === option.value"
              @change="emit('update:editionMode', option.value)">
            <span>{{ option.label }}</span>
          </label>
        </fieldset>
        <font-awesome-icon
          :icon="faCodeBranch"
          class="edition-mode__icon"
          aria-hidden="true" />
        <template v-if="matchingEditionCount != null">
          <span class="edition-mode__count edition-mode__count-mobile">
            {{ matchingEditionCount }} {{ matchingEditionCount === 1 ? "edition" : "editions" }}
          </span>
          <span class="edition-mode__count edition-mode__count-desktop">
            {{ matchingEditionCount }} matching
          </span>
        </template>
      </div>

      <div
        v-if="showResults"
        class="action-group search-result-actions__buttons noprint">
        <button
          v-if="canLoadMore"
          class="cc-button cc-button-primary search-result-actions__button search-result-actions__more-actions"
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

    <span
      v-if="showResults"
      class="search-result-actions__summary">
      {{ formattedSummary }}
    </span>
  </nav>
</template>

<script setup>
import { computed, useId } from "vue"
import { faCodeBranch } from "@fortawesome/free-solid-svg-icons"
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
  showResults: {
    type: Boolean,
    default: true,
  },
  editionMode: {
    type: String,
    default: "exclude",
  },
  matchingEditionCount: {
    type: Number,
    default: undefined,
  },
})

const emit = defineEmits([ "load-more", "show-all", "sort", "update:editionMode" ])
const sortOptions = SORT_OPTIONS
const sortSelectId = `search-result-actions-sort-${useId()}`
const editionModeName = `search-result-actions-editions-${useId()}`
const editionOptions = [
  { value: "exclude", label: "Exclude" },
  { value: "include", label: "Include" },
  { value: "only", label: "Only" },
]

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
