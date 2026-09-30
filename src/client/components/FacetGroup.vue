<template>
  <div>
    <button
      class="cc-button cc-button-primary facet-item"
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
            class="facet-option list-row"
            :class="{ 'selected-row': selected.includes(facet.value) }"
            tabindex="0"
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

          <li
            v-if="hasMore"
            class="facet-show-more">
            <button
              type="button"
              class="cc-button"
              @click.stop="openModal">
              see all {{ valuesRef.length }}
            </button>
          </li>
        </ul>
      </div>
    </transition>

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
                class="cc-button cc-button-ghost cc-button-icon facet-modal-close"
                aria-label="Close"
                @click="closeModal">
                <font-awesome-icon
                  icon="times-circle"
                  size="3x"
                  aria-hidden="true" />
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
                  :key="facet.value"
                  class="facet-modal-list__item list-row"
                  :class="{ 'selected-row': selected.includes(facet.value) }"
                  tabindex="0"
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

const MAX_INLINE_ITEMS = 6

const selected = toRef(props, "selected")
const valuesRef = toRef(props, "values")
const facetItemTitle = FACET_FIELD_LABELS[props.field].label
const facetValues = FACET_FIELD_LABELS[props.field].values || {}
const hasMore = computed(() => valuesRef.value.length > MAX_INLINE_ITEMS)

const emit = defineEmits(["change", "toggle", "modal-toggle"])

const visibleValues = computed(() => {
  if (hasMore.value) {
    return valuesRef.value.slice(0, MAX_INLINE_ITEMS)
  }
  return valuesRef.value
})


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
  emit("modal-toggle", true)
}

function closeModal() {
  showModal.value = false
  searchTerm.value = ""
  emit("modal-toggle", false)
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

function onCheckbox(e) {
  toggleValue(e.target.value, e.target.checked)
}

function onRow(value) {
  toggleValue(value)
}

</script>

<style scoped>
.options-list,
.facet-modal-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.facet-item {
  display: flex;
  width: 100%;
  padding: var(--cc-space-sm);
  border-radius: var(--cc-radius-md);
  text-align: inherit;
  justify-content: space-between;
}

.arrow {
  color: var(--cc-color-on-primary);
  position: relative;
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  border-right: 0.2em solid var(--cc-color-on-primary);
  border-top: 0.2em solid var(--cc-color-on-primary);
  transform: rotate(135deg);
}

.arrow.open {
  transform: rotate(315deg);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 120ms ease-out, transform 120ms ease-out;
}

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
  overflow: hidden;
}

.facet-option,
.facet-modal-list__item {
  cursor: pointer;
}

.facet-option:hover,
.facet-modal-list__item:hover {
  background-color: var(--cc-color-surface-muted);
  color: var(--cc-color-muted);
}

.facet-option:hover .facet-count,
.facet-modal-list__item:hover .facet-count {
  background-color: var(--cc-color-page);
  color: var(--cc-color-text);
}

.facet-count {
  margin-left: auto;
}

.facet-value {
  text-align: left;
}

.facet-show-more {
  padding-top: var(--cc-row-gap);
}

.facet-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--cc-color-backdrop);
  z-index: 50;
}

.facet-modal {
  position: fixed;
  top: 15vh;
  left: 50%;
  transform: translateX(-50%);
  background: var(--cc-color-surface-muted);
  max-width: 800px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--cc-shadow-lg);
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
  padding: var(--cc-row-padding-y) var(--cc-row-padding-x);
}

.facet-modal__title {
  margin: 0;
  color: var(--cc-color-text);
}

.facet-modal-close {
  margin: 0;
  position: absolute;
  top: calc(-1 * var(--cc-space-md));
  right: calc(-1 * var(--cc-space-sm));
  color: var(--cc-color-primary);
  border: none;
  background: transparent;
}

.facet-modal-close:hover,
.facet-modal-close:focus,
.facet-modal-close:focus-visible {
  color: var(--cc-color-primary);
}

.facet-modal__body {
  padding: var(--cc-row-padding-y) var(--cc-row-padding-x);
  overflow: auto;
  background: var(--cc-color-surface);
}

.facet-modal-search {
  width: 100%;
  margin-bottom: var(--cc-space-sm);
  padding: var(--cc-space-xs) var(--cc-space-sm);
  border-radius: var(--cc-radius-sm);
  border: 1px solid var(--cc-border-color-control);
  background: var(--cc-color-surface);
  color: var(--cc-color-text);
  min-height: calc(1.5em + 0.5rem + 2px);
}

.facet-modal-search::placeholder {
  color: var(--cc-color-muted);
}

.facet-modal-list {
  color: var(--cc-color-text);
}

.facet-modal-list__item .facet-value {
  flex: 1;
}

</style>
