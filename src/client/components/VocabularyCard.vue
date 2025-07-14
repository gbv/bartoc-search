<template>
  <div class="result-card">
    <h2 class="result-title">
      {{ title || fallbackTitle }}
    </h2>
    <p
      v-if="shortDescription"
      class="result-description">
      {{ shortDescription }}
    </p>
    <ul class="result-details">
      <li v-if="doc.publisher_label">
        <strong>Publisher:</strong> {{ doc.publisher_label }}
      </li>
      <li v-if="doc.languages_ss?.length">
        <strong>Languages:</strong> {{ doc.languages_ss.join(', ') }}
      </li>
      <li v-if="typeLabel.length">
        <strong>Type:</strong> {{ typeLabel.join(', ') }}
      </li>
      <li v-if="subjectList.length">
        <strong>Subjects:</strong> {{ subjectList.join(', ') }}
      </li>
    </ul>

    <div class="result-links">
      <a
        :href="doc.id"
        target="_blank"
        class="result-link">
        {{ doc.id }}
      </a>
      <a
        :href="`https://bartoc.org/api/data?uri=${doc.id}`"
        target="_blank"
        class="result-link">
        JSKOS
      </a>
      <a
        :href="getSolrRecord(doc.id)"
        target="_blank"
        class="result-link">Solr</a>
    </div>
  </div>
</template>

<script setup lang="js">
import { SupportedLang } from "../types/lang.js"
import { computed } from "vue"

/// <reference path="../types/solr.js" />

/**
 * @type {{ doc: SolrDocument, lang?: string }}
 */
const props = defineProps({
  doc: { type: Object, required: true },
  lang: {
    type: String,
    default: SupportedLang.EN,
    validator: (v) => Object.values(SupportedLang).includes(v),
  },
})

// const props = defineProps<{ doc: SolrDocument; lang?: SupportedLang }>()

// Helper to safely access dynamic fields on SolrDocument
/** @type {Object.<string, any>} */
const rawDoc = props.doc || {}

// Computed values for display
const title = computed(() => rawDoc[`title_${props.lang ?? "en"}`] || rawDoc.id)
const description = computed(
  () => rawDoc[`description_${props.lang ?? "en"}`] || "No description available.",
)
const typeLabel = computed(() => {
  const key = `type_label_${props.lang ?? "en"}`
  const val = rawDoc[key]
  if (Array.isArray(val)) {
    return val
  }
  if (typeof val === "string") {
    return [val]
  }
  return []
})
const fallbackTitle = computed(() => rawDoc.id)

// Extract subjects list safely
const subjectList = computed(() => {
  const key = `subject_${props.lang}`
  const val = rawDoc[key]
  return Array.isArray(val) ? val : []
})

// Abbreviate description to first 50 characters
const shortDescription = computed(() => {
  const desc = description.value
  return desc.length > 150 ? desc.slice(0, 150) + "..." : desc
})

function getSolrRecord(id) {
  return `${import.meta.env.BASE_URL}api/solr?id=${encodeURIComponent(id)}`
}
</script>

<style scoped>
.result-card {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;
  margin: 12px 8px;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
  text-align: left;
}
.result-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.result-title {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1a202c;
  margin: 4px 0px;
}

.result-description {
  font-size: 0.9rem;
  color: #4a5568;
  margin: 4px 0px;
  display: -webkit-box;
  overflow: hidden;
}

.result-details {
  list-style: none;
  padding: 0;
  margin: 0;
}
.result-details li {
  font-size: 0.85rem;
  color: #4a5568;
  margin-bottom: 4px;
}

.result-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.result-link {
  font-size: 0.85rem;
  color: #2b6cb0;
  text-decoration: none;
}
.result-link:hover {
  color: #2c5282;
  text-decoration: underline;
}
</style>
