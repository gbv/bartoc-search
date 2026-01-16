<script setup>
import { computed, ref, watch } from "vue"
import { getURIperIdentifierOrNamespace } from "../utils/namespaces"


const props = defineProps({
  uri: { type: String, required: true },
  name: { type: String, required: true },
 
})

const hasData = computed(() => !!(props.uri || props.name))

const resolvedEntry = ref(null)
const loading = ref(false)
const error = ref(null)

async function resolveEntry() {
  resolvedEntry.value = null
  error.value = null
  if (!props.uri) {
    return
  }

  loading.value = true
  try {
    resolvedEntry.value = await getURIperIdentifierOrNamespace(props.uri)
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

watch(() => props.uri, resolveEntry, { immediate: true })

// true when the entry has neither identifier nor namespace
const showBartocOnly = computed(() => {
  const e = resolvedEntry.value
  return Object.hasOwn(e, "identifier") === false && Object.hasOwn(e, "namespace") === false
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
    <span class="lookup-message__wrapper">
      <template v-if="loading">…</template>
      <template v-else-if="resolvedEntry">
        <div v-if="showBartocOnly">
          <span
            class="lookup-message__type">
            is likely an URI from <a href="https://bartoc.org/">BARTOC</a>
          </span>
        </div>
        <div v-else-if="resolvedEntry.identifier">
          <span
            class="lookup-message__type">
            is likely an identifier from
          </span> 
          <a
            class="lookup-message__link"
            :href="resolvedEntry.identifier[0] || '#'"
            target="_blank">{{ name }}</a>
        </div>
        <div v-else-if="resolvedEntry.namespace">
          <span
            class="lookup-message__type">
            is likely a namespace from
          </span> 
          <a
            class="lookup-message__link"
            :href="resolvedEntry.namespace || '#'"
            target="_blank">{{ name }}</a>
        </div>
      </template>
      <template v-else>
        {{ name }}
      </template>
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
  margin-left: 5px;
}
.lookup-message__link {
  margin-left: 5px;
}
</style>
