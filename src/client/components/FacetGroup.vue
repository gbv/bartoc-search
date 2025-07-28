<template>
  <div>
    <button
      class="facet-item" 
      type="button"
      :aria-expanded="open"
      @click="toggleOpen">
      <span class="facet-item__title">{{ facetItemTitle }}</span>
      <span
        class="arrow"
        :class="{ open }"
        aria-hidden="true" />
    </button>
    <transition name="dropdown">
      <div
        v-if="open"
        class="options-container">
        <ul
          v-if="open"
          key="list"
          class="options-list">
          <li
            v-for="facet in values"
            :key="facet.value">
            <input
              type="checkbox"
              :value="facet.value"
              :checked="selected.includes(facet.value)"
              @change="onCheck">
            <span class="facet-value">{{ facetValues[facet.value] ?? facet.value }}</span>
            <span class="facet-count">{{ facet.count }}</span>
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, toRef } from "vue"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"

const props = defineProps({
  field: { type: String, required: true },
  values: { type: Array, required: true },
  selected: { type: Array, default: () => [] },
})

const facetItemTitle = FACET_FIELD_LABELS[props.field].label
const facetValues = FACET_FIELD_LABELS[props.field].values || {}

// local open/closed state
const open = ref(false)

const emit = defineEmits(["change"])
const selected = toRef(props, "selected")

function toggleOpen() {
  emit("change", [])
  open.value = !open.value
}

function onCheck(e) {
  const val = e.target.value
  const newSel = e.target.checked
    ? [...selected.value, val]
    : selected.value.filter(v => v !== val)
  emit("change", newSel)
}
</script>

<style scoped>
ul {
  list-style: none;
  padding: 0;
}
.facet-item {
  border-bottom-right-radius: 4px;
  border-bottom-left-radius: 4px;
}

.facet-group .facet-item {
  display: flex;
  width: 100%;
  padding-right: 8px;
  border: 1px solid var(--divider-light-1);
  text-align: inherit;
  justify-content: space-between;
}

.facet-badge {
  background: var(--color-button-background);
  color: white;
  border-radius: 1em;
  padding: 0 0.5em;
  font-size: 0.75em;
  margin-left: 0.5em;
}

.arrow {
  position: relative;
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  border-right: 0.2em solid black;
  border-top: 0.2em solid black;
  transform: rotate(135deg);
}

.arrow.open {
  transform: rotate(315deg);
}

/* transition the max-height over 0.4s */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: max-height 0.4s ease;
}

/* start/end states */
.dropdown-enter-from,
.dropdown-leave-to {
  max-height: 0;
}
.dropdown-enter-to,
.dropdown-leave-from {
  /* big enough to accommodate your full list */
  max-height: 500px;
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
  border: 1px solid var(--divider-light-1);
  padding: 5px;
}

.options-list li:hover {
  background-color: var(--color-background-soft);
  color: var(--color-text-light-2);
}

/* highlight facet-count on li hover */
.options-list li:hover .facet-count {
  background-color: var(--color-background);
  border-radius: 2px;
  color: var(--color-text-light-1);
}

.options-list li:first-child {
  border-top: none;
}

.options-list li:not(:last-child) {
  border-bottom: none;
}

.facet-count {
  margin-left: auto;
}

.facet-value {
  padding-left: 5px;
  text-align: left;
}

</style>