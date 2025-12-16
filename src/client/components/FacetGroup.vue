<template>
  <div>
    <button
      class="facet-item" 
      type="button"
      :aria-expanded="open"
      @click="toggleOpen">
      {{ facetItemTitle }}
      <span
        class="arrow"
        :class="{ open }"
        aria-hidden="true" />
    </button>

    <transition name="dropdown">
      <div
        v-if="open"
        class="options-container">
        <ul class="options-list">
          <li
            v-for="facet in visibleValues"
            :key="facet.value"
            @click="onRow(facet.value)"
            @keydown.enter.prevent="onRow(facet.value)"
            @keydown.space.prevent="onRow(facet.value)">
            <input
              type="checkbox"
              :value="facet.value"
              :checked="selected.includes(facet.value)"
              @change="onCheckbox"
              @click.stop>
            <span class="facet-value">
              {{ facetValues[facet.value] ?? (facet.value === '-' ? 'no value' : facet.value) }}
            </span>
            <span class="facet-count">{{ facet.count }}</span>
          </li>

          <!-- “Show all” only if we have more than MAX_INLINE_ITEMS -->
          <li
            v-if="hasMore"
            class="facet-show-more">
            <button
              type="button"
              @click.stop="openModal">
              see all {{ valuesRef.length }}
            </button>
          </li>
        </ul>
      </div>
    </transition>

    <!-- Modal with all entries for this facet -->
    <teleport to="body">
      <transition name="facet-modal">
        <div
          v-if="showModal"
          class="facet-modal-backdrop"
          @click.self="closeModal">
          <div
            class="facet-modal"
            role="dialog"
            :aria-label="facetItemTitle + ' facet filters'"
            aria-modal="true">
            <header class="facet-modal__header">
              <h2 class="facet-modal__title">
                {{ facetItemTitle }}
              </h2>
              <button
                type="button"
                class="facet-modal-close"
                aria-label="Close"
                @click="closeModal">
                <vue-feather
                  type="x-circle"
                  size="40"
                  stroke-width="3"
                  aria-hidden="true"
                  stroke="var(--red)" />
              </button>
            </header>

            <div class="facet-modal__body">
              <input
                v-if="valuesRef.length > 20"
                v-model="searchTerm"
                type="search"
                class="facet-modal-search"
                :placeholder="`Filter ${facetItemTitle.toLowerCase()}…`">
              <ul
                v-if="filteredValues"
                class="facet-modal-list">
                <li
                  v-for="facet in filteredValues"
                  :key="facet.value">
                  <input
                    type="checkbox"
                    :value="facet.value"
                    :checked="selected.includes(facet.value)"
                    @change="onCheckbox">
                  <span class="facet-value">
                    {{ facetValues[facet.value] ?? (facet.value === '-' ? 'no value' : facet.value) }}
                  </span>
                  <span class="facet-count">{{ facet.count }}</span>
                </li>
              </ul>
              <div v-else>
                Nothing found
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { toRef, computed, ref } from "vue"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"
import { state, markFilterRequested } from "../stores/filters.js"

const props = defineProps({
  field: { type: String, required: true },
  values: { type: Array, required: true },
  selected: { type: Array, default: () => [] },
  open: {type: Boolean},
})

// --- “show first N items only” ---
const MAX_INLINE_ITEMS = 6

const selected = toRef(props, "selected")
const valuesRef = toRef(props, "values")
const facetItemTitle = FACET_FIELD_LABELS[props.field].label
const facetValues = FACET_FIELD_LABELS[props.field].values || {}
const hasMore = computed(() => valuesRef.value.length > MAX_INLINE_ITEMS)

const emit = defineEmits(["change", "toggle"])

const visibleValues = computed(() => {
  if (hasMore.value) {
    return valuesRef.value.slice(0, MAX_INLINE_ITEMS)
  }
  return valuesRef.value
})


// --- Modal state ---
const showModal = ref(false)
const searchTerm = ref("")

const filteredValues = computed(() => {
  if (!searchTerm.value) {
    return valuesRef.value
  }
  const q = searchTerm.value.toLowerCase()
  return valuesRef.value.filter(facet => {
    const label =
      facetValues[facet.value] ??
      (facet.value === "-" ? "no value" : String(facet.value))
    return label.toLowerCase().includes(q)
  })
})

function openModal() {
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  searchTerm.value = ""
}

function toggleOpen() {
  const isOpening = !props.open
  emit("toggle", isOpening)

  // We want a "bucket-only" request only if:
  // - we are opening the facet,
  // - no values are currently selected for this field,
  // - we have already asked bucket in the past.
  const hasSelected =
    Array.isArray(state.activeFilters[props.field]) &&
    state.activeFilters[props.field].length > 0

  if (isOpening && !hasSelected && !state.filtersRequested[props.field]) {
    markFilterRequested(props.field)
    // change([]) is interpreted as "only get buckets"
    emit("change", [])
  }
}

function toggleValue(value, nextState) {
  const isSelected = selected.value.includes(value)
  const willBeSelected = nextState ?? !isSelected
  const newSel = willBeSelected
    ? [...selected.value, value]
    : selected.value.filter(v => v !== value)
  emit("change", newSel)
}

// Selecting the checkbox
function onCheckbox(e) {
  toggleValue(e.target.value, e.target.checked)

  // If the user clicked inside the modal, close it right after selection
  if (showModal.value) {
    closeModal()
  }
}

// Clicking on the entire row
function onRow(value) {
  toggleValue(value)
  
  if (showModal.value) {
    closeModal()
  }
}

</script>

<style scoped>
ul {
  list-style: none;
  padding: 0;
}

.facet-group .facet-item {
  display: flex;
  width: 100%;
  padding: 0.5rem;
  border-radius: 0;
  text-align: inherit;
  justify-content: space-between;
}

.facet-badge {
  background: var(--color-button-background);
  color: white;
  padding: 0 0.5em;
  font-size: 0.75em;
  margin-left: 0.5em;
}

.arrow {
  color: white;
  position: relative;  
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  border-right: 0.2em solid var(--color-button-text);;
  border-top: 0.2em solid var(--color-button-text);;
  transform: rotate(135deg);
}

.arrow.open {
  transform: rotate(315deg);
}

/* transition the max-height over 0.4s */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 120ms ease-out, transform 120ms ease-out;
}

/* start/end states */
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.options-container {
  overflow: hidden;
}

.options-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

.options-list li {
  cursor: pointer;
  display: flex;
  padding: 5px;
}

.options-list li:hover {
  background-color: var(--color-background-soft);
  color: var(--color-text-light-2);
}

/* highlight facet-count on li hover */
.options-list li:hover .facet-count {
  background-color: var(--color-background);
  color: var(--color-text-light-1);
}

.facet-count {
  margin-left: auto;
}

.facet-value {
  padding-left: 5px;
  text-align: left;
}

/* “Show all …” row */
.facet-show-more {
  padding: 5px;
}

.facet-show-more button {
  background: none;
  border: none;
  padding: 0;
  color: var(--link-color);
  cursor: pointer;
  text-decoration: none;
  padding-left: 4px; /* visual alignment with facet values */
}


/* Simple modal styling */
.facet-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-backdrop);
  z-index: 50;
}

.facet-modal {
  position: fixed;
  top: 15vh;
  left: 50%;
  transform: translateX(-50%);
  background: var(--white-mute); 
  max-width: 800px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}

.facet-modal-enter-active,
.facet-modal-leave-active {
  transition: opacity 150ms ease-out;
}

.facet-modal-enter-from,
.facet-modal-leave-to {
  opacity: 0;
}

.facet-modal-enter-active .facet-modal,
.facet-modal-leave-active .facet-modal {
  transition: transform 150ms ease-out, opacity 150ms ease-out;
}

.facet-modal-enter-from .facet-modal {
  transform: translateX(-50%) translateY(-10px);
  opacity: 0;
}

.facet-modal-leave-to .facet-modal {
  transform: translateX(-50%) translateY(-10px);
  opacity: 0;
}

.facet-modal__header {
  padding: 0.75rem 1rem;
}

.facet-modal__title {
  margin: 0;
  color: var(--gray-800);
}

.facet-modal-close {
  border: none;
  border-radius: 50px;
  padding: 0;
  margin: 0;
  background: var(--white-mute);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: -15px;
  right: -15px;
  color: var(--gray-700);
}  

.facet-modal-close:hover {
  outline: none;
  background: var(--white);
}

.facet-modal__body {
  padding: 0.75rem 1rem;
  overflow: auto;
  background: var(--color-surface);
}

.facet-modal-search {
  width: 100%;
  margin-bottom: 0.5rem;
  border-radius: 3px;
  border: 1px solid var(--gray-300);
  background: var(--white);
  color: var(--color-text-light-1);
  height: 30px;
}

.facet-modal-search::placeholder {
  color: var(--gray-500);
}

.facet-modal-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.facet-modal-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 4px 0;
  padding-right: 8px;
  color: var(--color-text-light-1);
  cursor: pointer;
}

.facet-modal-list li:hover {
  background: var(--white);
}

.facet-modal-list li .facet-value {
  flex: 1;
}

</style>
