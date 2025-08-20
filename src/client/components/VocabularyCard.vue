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
      <li v-if="doc.publisher_labels_ss">
        <strong>Publisher:</strong> {{ doc.publisher_labels_ss[0] }}
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
    <div class="result-metadata">
      <a
        :href="doc.id"
        target="_blank">
        {{ doc.id }}
      </a>
      <span
        v-if="doc.created_dt"
        :class="{ highlighted: sort == 'created' }">        
        created {{ doc.created_dt.replace(/:..Z.*/,"").replace("T","&nbsp;") }}
      </span>
      <span
        v-if="doc.modified_dt"
        :class="{ highlighted: sort == 'modified' }">
        modified {{ doc.modified_dt.replace(/:..Z.*/,"").replace("T","&nbsp;") }}
      </span>
      <a
        :href="JskosRecord(doc.id)"
        target="_blank">JSKOS</a>
      <a
        :href="getSolrRecord(doc.id)"
        target="_blank">Solr</a>
    </div>
  </div>
</template>

<script setup lang="js">
import { SupportedLang } from "../types/lang.js"
import { computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()

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
  sort: { type: String },
})


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

function serializeQuery(params) {
  const res = Object.entries(params)
    .map(([key, val]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(val)}`,
    )
    .join("&")

  return res
}

function JskosRecord(id) {
  return `${import.meta.env.BASE_URL}api/search?${serializeQuery(route.query)}&format=jskos&uri=${encodeURIComponent(id)}`
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
  color: #4a5568;
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
  margin-bottom: 4px;
}

.result-metadata {
  display: flex;
  flex-wrap: wrap;
  font-size: 0.85rem;
}
.result-metadata * {
  padding: 0.2rem 0.5rem 0.2rem 0;
}
.result-metadata span {
  padding: 0.2rem 0.5rem;
  margin-right: 0.2rem;
}

.highlighted {
  background: #ff9;
  color: #000;
}
</style>
