<template>
  <span
    class="filter-badge"
    :title="`${label}: ${value}`">
    <span class="filter-badge__text">
      <span class="filter-badge__label">{{ label }}:</span>
      <span class="filter-badge__value">{{ displayValue }}</span>
    </span>
    <button
      class="filter-badge__close"
      :aria-label="`Remove Badge ${label}: ${displayValue}`"
      type="button"
      @click="emit('remove-badge')" />
  </span>
</template>

<script setup>
import {computed } from "vue"

const emit = defineEmits(["remove-badge"])


const props = defineProps({
  label: { type: String, required: true },   // public key label (e.g. "language")
  value: { type: String, required: true },   // raw value (e.g. "en" or "-")
})

const displayValue = computed(() => (props.value === "-" ? "No value" : props.value))
</script>

<style scoped>
.filter-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px;
  color: var(--color-text-light-1);
  font-size: 15px;
  margin-right: 12px;
  text-transform: capitalize;
}
.filter-badge__label { 
    margin-right: 8px;
}
.filter-badge__value { 
    font-weight: 600;
    margin-right: 8px;
}
.filter-badge__close {
  appearance: none;
  border: 0;
  text-align: center;
  cursor: pointer;
  padding: 0;
}
.filter-badge__close:hover { 
    background: #d1d5db; 
}

.filter-badge__close::before {
  content: "x";
  padding: 12px
}

</style>
