<template>
  <div class="result-card">
    <h2 class="result-title">
      <a
        :href="doc.id"
        target="_blank">
        {{ title }}
      </a>
      <a
        v-if="doc.api_url_ss?.length"
        class="api-link"
        :href="doc.id + '#access'"
        target="_blank">API</a>
    </h2>
    <p
      v-if="shortDescription"
      class="result-description">
      {{ shortDescription }}
    </p>
    <ul class="result-details">
      <li v-if="typeLabel.length || doc.languages_ss?.length">
        <strong v-if="typeLabel.length">
          {{ typeLabel.join(', ') }}
        </strong>
        <span v-if="doc.languages_ss?.length">
          ({{ doc.languages_ss.join(', ') }})
        </span>
      </li>
      <li v-if="subjectList.length">
        <strong>Subjects:</strong> {{ subjectList.join(', ') }}
      </li>
      <li v-if="doc.publisher_labels_ss">
        <strong>Published by </strong> {{ doc.publisher_labels_ss[0] }}
      </li>
    </ul>
    <div class="result-metadata">
      <span
        v-if="doc.created_dt"
        :class="{ highlighted: sort == 'created' }">       
        created {{ doc.created_dt.replace(/[T ].*/,"") }}
      </span>
      <span
        v-if="doc.modified_dt"
        :class="{ highlighted: sort == 'modified' }">
        modified {{ doc.modified_dt.replace(/[T ].*/,"") }}
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

// Showing the english description by default
// TODO: searching for the description available, in not in english?
const description = computed(
  () => rawDoc[`definition_${props.lang ?? "en"}`] ?
    rawDoc[`definition_${props.lang ?? "en"}`][0] :
    "No description available.",
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

// Extract subjects list safely
const subjectList = computed(() => {
  const key = `subject_${props.lang}`
  const val = rawDoc[key]
  return Array.isArray(val) ? val : []
})

// TODO: use CSS text-overflow: ellipsis instead
const shortDescription = computed(() => {
  const desc = description.value.replace(/^"/,"")
  const cutoff = 230
  return desc.length > cutoff ? desc.slice(0, cutoff) + "..." : desc
})

const getSolrRecord = id =>
  `${import.meta.env.BASE_URL}api/solr?id=${encodeURIComponent(id)}`

const serializeQuery = params =>
  Object.entries(params)
    .map(([key, val]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(val)}`,
    )
    .join("&")

const JskosRecord = id =>
  `${import.meta.env.BASE_URL}api/search?${serializeQuery(route.query)}&format=jskos&uri=${encodeURIComponent(id)}`

</script>

<style>
.result-card {
  margin: 12px 8px;
  padding: 0.75rem 1rem;
  text-align: left;
  color: var(--color-text);

  background-color: var(--color-surface);            /* #f8f9fa */
  border: 1px solid var(--color-surface-border);     /* #e9ecef */
  border-radius: 6px;

  border-left-width: 3px;
  border-left-style: solid;
  border-left-color: transparent;

  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);

  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out,
    border-left-color 120ms ease-out,
    box-shadow 120ms ease-out,
    transform 80ms ease-out;
}

.result-card:hover {
  background-color: var(--color-background-soft);
  border-color: var(--color-border-hover);
  border-left-color: var(--red);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.result-title {
  font-size: 1.1rem;
  margin: 4px 0 6px;
  border-bottom: 1px dotted var(--color-border);
  padding-bottom: 2px;
}

.result-title a {
  color: var(--color-heading);
  font-weight: 600;
}

.result-title a.api-link {
  float: right;
  font-size: 0.9rem;
}

.result-description {
  font-size: 0.9rem;
  margin: 0.35rem 0.3rem;
  color: var(--color-text-light-2);
}

.result-details {
  margin: 0.3rem;
  list-style: none;
  padding: 0;
}

.result-details li {
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.result-metadata {
  border-top: 1px dotted var(--color-border);
  font-size: 0.8rem;
  padding: 0.25rem 0;
  margin-top: 0.25rem;
  color: var(--color-text-light-2);
}

.result-metadata * {
  margin-right: 0.5rem;
}

.highlighted {
  background: #fffbcc;
  color: #000;
}
</style>
