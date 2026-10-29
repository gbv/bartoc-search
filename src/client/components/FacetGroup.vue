<template>
  <div>
    <button
      class="cc-button cc-button-secondary facet-item"
      type="button"
      :aria-expanded="open"
      @click="toggleOpen">
      <span class="facet-item__label">{{ facetItemTitle }}</span>
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
            :key="facet.value">
            <label
              class="facet-option list-row"
              :class="{ 'selected-row': props.selected.includes(facet.value) }">
              <input
                type="checkbox"
                :value="facet.value"
                :aria-label="facetLabel(facet.value)"
                :checked="props.selected.includes(facet.value)"
                @change="onCheckbox"
                @keydown.enter.prevent="toggleValue(facet.value)">
              <span class="facet-value">
                {{ facetLabel(facet.value) }}
              </span>
              <span class="facet-count">{{ facet.count }}</span>
            </label>
          </li>

          <li
            v-if="hasMore"
            class="facet-show-more">
            <button
              type="button"
              class="cc-button cc-button-ghost facet-show-more__button"
              @click.stop="openModal">
              see all {{ props.values.length }}
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
          :style="modalViewportStyle"
          @click.self="closeModal">
          <div
            class="facet-modal"
            role="dialog"
            :aria-label="facetItemTitle + ' facet filters'"
            aria-modal="true"
            @keydown.esc.stop="closeModal">
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
                  class="facet-modal-close__icon"
                  icon="times-circle"
                  size="lg"
                  aria-hidden="true" />
              </button>
            </header>

            <div class="facet-modal__body">
              <input
                v-if="props.values.length > 20"
                v-model="searchTerm"
                type="search"
                class="facet-modal-search"
                :placeholder="`Filter ${facetItemTitle.toLowerCase()}…`">
              <ul
                v-if="filteredValues.length"
                class="facet-modal-list">
                <li
                  v-for="facet in filteredValues"
                  :key="facet.value">
                  <label
                    class="facet-option list-row"
                    :class="{ 'selected-row': props.selected.includes(facet.value) }">
                    <input
                      type="checkbox"
                      :value="facet.value"
                      :aria-label="facetLabel(facet.value)"
                      :checked="props.selected.includes(facet.value)"
                      @change="onCheckbox"
                      @keydown.enter.prevent="toggleValue(facet.value)">
                    <span class="facet-value">
                      {{ facetLabel(facet.value) }}
                    </span>
                    <span class="facet-count">{{ facet.count }}</span>
                  </label>
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
import { computed, ref, watch } from "vue"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"
import { state, markFilterRequested } from "../stores/filters.js"

const props = defineProps({
  field: { type: String, required: true },
  values: { type: Array, required: true },
  selected: { type: Array, default: () => [] },
  open: {type: Boolean},
})

const MAX_INLINE_ITEMS = 6

const facetItemTitle = FACET_FIELD_LABELS[props.field].label
const facetValues = FACET_FIELD_LABELS[props.field].values || {}
const hasMore = computed(() => props.values.length > MAX_INLINE_ITEMS)
const valueOrder = ref([])

// Solr reorders buckets as counts change. Remember their first position and append new values.
watch(() => props.values, values => {
  const seen = new Set(valueOrder.value)
  for (const { value } of values) {
    seen.add(value)
  }
  valueOrder.value = [...seen]
}, { immediate: true })

const orderedValues = computed(() => {
  // Use the latest counts, omitting values no longer present in the response.
  const byValue = new Map(props.values.map(item => [item.value, item]))
  return valueOrder.value.flatMap(value => byValue.get(value) ?? [])
})

const emit = defineEmits(["change", "toggle", "modal-toggle"])

const visibleValues = computed(() => orderedValues.value.slice(0, MAX_INLINE_ITEMS))

const showModal = ref(false)
const searchTerm = ref("")
const modalViewportStyle = ref({})

// The modal is teleported outside the mobile drawer, so follow the visible viewport.
function updateModalViewport() {
  const viewport = window.visualViewport
  modalViewportStyle.value = viewport ? {
    left: `${viewport.offsetLeft}px`,
    top: `${viewport.offsetTop}px`,
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
  } : {}
}

// Listen for viewport changes only while the modal is open.
watch(showModal, (open, _, onCleanup) => {
  if (!open || typeof window === "undefined") {
    return
  }

  updateModalViewport()
  window.visualViewport?.addEventListener("scroll", updateModalViewport)
  window.visualViewport?.addEventListener("resize", updateModalViewport)
  onCleanup(() => {
    window.visualViewport?.removeEventListener("scroll", updateModalViewport)
    window.visualViewport?.removeEventListener("resize", updateModalViewport)
  })
})

function facetLabel(value) {
  return facetValues[value] ?? (value === "-" ? "— none —" : String(value))
}

const filteredValues = computed(() => {
  if (!searchTerm.value) {
    return orderedValues.value
  }
  const q = searchTerm.value.toLowerCase()
  return orderedValues.value.filter(facet => facetLabel(facet.value).toLowerCase().includes(q))
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

  // Request this facet's buckets on its first opening when it has no selection.
  if (isOpening && !state.activeFilters[props.field]?.length && !state.filtersRequested[props.field]) {
    markFilterRequested(props.field)
    // The parent interprets change([]) as a bucket-only request.
    emit("change", [])
  }
}

// The parent owns the selection. Native changes pass the checked state; Enter toggles it.
function toggleValue(value, nextState) {
  const willBeSelected = nextState ?? !props.selected.includes(value)
  const nextSelection = willBeSelected
    ? [...props.selected, value]
    : props.selected.filter(v => v !== value)
  emit("change", nextSelection)
}

function onCheckbox(e) {
  toggleValue(e.target.value, e.target.checked)
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
  gap: var(--cc-space-sm);
  min-height: var(--cc-touch-target-size);
  padding: var(--cc-row-padding-y) var(--cc-row-padding-x);
  border: 0;
  border-radius: 0;
  background: var(--cc-color-surface);
  color: var(--cc-color-text);
  text-align: left;
  justify-content: space-between;
}

.facet-item:hover,
.facet-item[aria-expanded="true"] {
  color: var(--cc-color-primary);
}

.facet-item[aria-expanded="true"] {
  background: var(--cc-color-accent);
}

.facet-item:focus-visible,
.facet-show-more__button:focus-visible {
  outline: var(--cc-border-width-strong) solid var(--cc-color-primary);
  outline-offset: 0;
}

.arrow {
  flex: none;
  width: var(--cc-space-sm);
  height: var(--cc-space-sm);
  margin-right: var(--cc-space-xs);
  border-right: var(--cc-border-width-strong) solid var(--cc-color-muted);
  border-top: var(--cc-border-width-strong) solid var(--cc-color-muted);
  transform: rotate(135deg);
}

.facet-item[aria-expanded="true"] .arrow,
.facet-item:hover .arrow {
  border-color: var(--cc-color-primary);
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
.options-container {
  overflow: hidden;
}

.options-list {
  padding-block: var(--cc-space-xs);
}

/* Inline values and modal values share the same row and checkbox styles. */
.facet-option {
  cursor: pointer;
  min-height: var(--cc-touch-target-size);
  padding: var(--cc-space-xs) var(--cc-row-padding-x);
}

.facet-option input {
  appearance: none;
  display: grid;
  place-content: center;
  flex: none;
  width: var(--cc-space-md);
  height: var(--cc-space-md);
  margin: 0;
  border: var(--cc-border-width) solid var(--cc-border-color-control);
  border-radius: 50%;
  background: var(--cc-color-surface);
  cursor: pointer;
}

.facet-option input:checked {
  border-color: var(--cc-color-primary);
  background: var(--cc-color-primary);
}

.facet-option input::before {
  content: "";
  width: calc(var(--cc-space-sm) - var(--cc-border-width-strong));
  height: var(--cc-space-sm);
  border-right: var(--cc-border-width-strong) solid var(--cc-color-on-primary);
  border-bottom: var(--cc-border-width-strong) solid var(--cc-color-on-primary);
  opacity: 0;
  transform: translateY(calc(-1 * var(--cc-border-width))) rotate(45deg);
}

.facet-option input:checked::before {
  opacity: 1;
}

.facet-option:hover {
  background-color: var(--cc-color-surface-muted);
}

.facet-option.selected-row {
  background-color: color-mix(in srgb, var(--cc-color-accent) 25%, var(--cc-color-surface));
}

.facet-option input:focus-visible {
  outline: var(--cc-border-width-strong) solid var(--cc-color-primary);
  outline-offset: var(--cc-space-xs);
}

.facet-count {
  flex: none;
  margin-left: auto;
  color: var(--cc-color-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.facet-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: left;
}

.selected-row .facet-value,
.selected-row .facet-count {
  color: var(--cc-color-primary);
}

.facet-show-more {
  padding-top: var(--cc-space-xs);
}

.facet-show-more__button {
  padding: var(--cc-space-xs) var(--cc-row-padding-x);
  border-color: transparent;
  background: transparent;
  color: var(--cc-color-primary);
  font-size: var(--cc-font-size-sm);
}

.facet-show-more__button:hover,
.facet-show-more__button:focus {
  border-color: transparent;
  background: var(--cc-color-accent);
  color: var(--cc-color-primary);
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
  width: calc(100% - 2 * var(--cc-space-lg));
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

.facet-modal-enter-from .facet-modal,
.facet-modal-leave-to .facet-modal {
  transform: translateX(-50%) translateY(-10px);
  opacity: 0;
}

.facet-modal__header {
  padding: var(--cc-row-padding-y) var(--cc-row-padding-x);
  padding-inline-end: var(--cc-space-xl);
}

.facet-modal__title {
  margin: 0;
  color: var(--cc-color-text);
}

.facet-modal-close {
  margin: 0;
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(50%, -50%);
  width: var(--cc-touch-target-size);
  min-width: var(--cc-touch-target-size);
  min-height: var(--cc-touch-target-size);
  padding: 0;
  font-size: var(--cc-font-size-xl);
  color: var(--cc-color-primary);
  border: none;
  background: transparent;
}

.facet-modal-close:hover,
.facet-modal-close:focus {
  color: var(--cc-color-primary);
}

/* The cross is a transparent cutout in the icon. */
.facet-modal-close__icon {
  width: 1em;
  border-radius: 50%;
  background: var(--cc-color-on-primary);
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

@media (forced-colors: active) {
  .facet-option input {
    appearance: auto;
  }
}

@media (max-width: 767px) {
  .facet-item {
    white-space: normal;
  }

  .facet-item__label {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .facet-modal-backdrop {
    inset: auto;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--cc-space-lg);
    z-index: 110;
  }

  .facet-modal {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
    width: 100%;
    max-width: none;
    max-height: 100%;
    border-radius: var(--cc-radius-md);
  }

  .facet-modal__header {
    margin: 0;
    border-bottom: 1px solid var(--cc-border-color-control);
  }

  .facet-modal__title {
    font-size: var(--cc-font-size-lg);
    overflow-wrap: anywhere;
  }

  .facet-modal__body {
    min-height: 0;
    border-radius: 0 0 var(--cc-radius-md) var(--cc-radius-md);
  }

  .facet-modal-enter-from .facet-modal,
  .facet-modal-leave-to .facet-modal {
    transform: translateY(-10px);
  }
}

</style>
