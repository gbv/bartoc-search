<script setup>
import { computed } from "vue"
import { getURIperIdentifierOrNamespace } from "../utils/namespaces"


const props = defineProps({
  uri: { type: String, required: true },
  name: { type: String, required: true },
 
})

const hasData = computed(() => !!(props.uri || props.name))

// Bartoc record uri
const resolvedUri = computed(() => {
  if (!props.uri) {
    return null
  }
  return getURIperIdentifierOrNamespace(props.uri)
})
</script>

<template>
  <div
    v-if="hasData"
    class="lookup-message">
    <span class="lookup-message__uri">
      <a
        :href="uri"
        target="_blank">{{ uri }}</a>
    </span>
    <span>is likely an URI from</span>
    <span class="lookup-message__name">
      <a
        :href="resolvedUri || '#'"
        target="_blank"
        :class="{ disabled: !resolvedUri }">
        {{ name }}
      </a>
    </span>
  </div>
</template>

<style scoped>
.lookup-message {
  color: var(--black);
  display: flex;
  justify-content: center;
  padding: 12px;
}
.lookup-message__uri {
  background: #ff9;
  margin-right: 5px;
}
.lookup-message__name {
  font-weight: bold;
  margin-left: 5px;
}
a.disabled {
  pointer-events: none;
  color: gray;
  text-decoration: line-through;
}
</style>
