<template>
  <label class="filter-badge">
    <input
      type="checkbox"
      class="noprint"
      checked
      :aria-label="label + ': ' + displayValue"
      @change="emit('remove-badge')">
    <span>{{ displayValue }}</span>
  </label>
</template>

<script setup>
import { computed } from "vue"

const emit = defineEmits(["remove-badge"])

const props = defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
})

const displayValue = computed(() => (props.value === "-" ? "No value" : props.value))
</script>

<style scoped>
.filter-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--cc-space-xs);
  padding: var(--cc-space-xs) 0;
  color: var(--cc-color-text);
  font-size: var(--cc-font-size-sm);
  cursor: pointer;
  text-transform: capitalize;
}
</style>
