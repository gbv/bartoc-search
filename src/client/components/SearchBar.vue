<template>
  <BartocSearchBar
    v-model:search="search"
    v-model:field="field"
    class="search-bar"
    @submit="onSearch" />
</template>

<script setup lang="js">
import { ref, onMounted, inject, watch } from "vue"
import { useRoute } from "vue-router"
import { BartocSearchBar } from "@gbv/bartoc-components"
const namespaces = inject("namespaces", null)

/**
 * @type {{ searchOnMounted: boolean }}
 */
const props = defineProps({
  searchOnMounted: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["search", "lookupUri"])

const route = useRoute()
const search = ref(route.query.search?.toString() || "")
const field = ref(route.query.field?.toString() || "")
const limit = ref(route.query.limit?.toString() || "10")

watch(
  () => [route.query.search, route.query.field, route.query.limit],
  () => {
    search.value = queryValue(route.query.search)
    field.value = queryValue(route.query.field)
    limit.value = queryValue(route.query.limit, "10")
  },
  { immediate: true },
)

watch(search, lookupUri, { immediate: true })

function queryValue(value, fallback = "") {
  if (Array.isArray(value)) {
    return value[0]?.toString() || fallback
  }

  return value?.toString() || fallback
}

function onSearch(query = currentQuery()) {
  const searchQuery = { ...query }

  if (limit.value) {
    searchQuery.limit = limit.value
  }

  emit("search", searchQuery)
}

if (props.searchOnMounted) {
  onMounted(() => onSearch())
}

function currentQuery() {
  const query = { search: search.value.trim() }

  if (field.value) {
    query.field = field.value
  }

  return query
}

function lookupUri() {
  const q = (search.value || "").trim()
  if (!isHttpUrl(q)) {
    return emit("lookupUri", {})
  }

  const name = namespaces?.lookup?.(q)
  return emit("lookupUri", name ? { uri: q, name } : {})
}

function isHttpUrl(v) {
  if (typeof v !== "string") {
    return false
  }
  try {
    const u = new URL(v.trim())
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}
</script>
