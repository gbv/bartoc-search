<template>
  <div class="result-card">
    <h2 class="result-title">
      <a :href="titleHref">
        {{ title }}
      </a>
      <a
        v-if="doc.api_url_ss?.length"
        class="api-link"
        :href="titleHref + '#content'">Content</a>
    </h2>
    <p
      v-if="shortDescription"
      class="result-description">
      {{ shortDescription }}
    </p>
    <ul class="result-details">
      <li v-if="typeItems.length || doc.languages_ss?.length">
        <strong
          v-if="typeItems.length"
          class="kos-type-list">
          <template
            v-for="(type, index) in typeItems"
            :key="type.uri || type.label">
            <span class="kos-type-list__item">
              {{ type.label }}
              <span
                v-if="type.description"
                class="kos-type-info"
                :aria-label="`${type.label}: ${type.description}`"
                :title="type.description"
                tabindex="0">
                <font-awesome-icon
                  icon="info-circle"
                  size="xl" />
              </span>
            </span><span v-if="index < typeItems.length - 1">, </span>
          </template>
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
    <div class="result-metadata noprint">
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
        :href="getJskosRecord(doc.id)"
        target="_blank">JSKOS</a>
      <a
        :href="getSolrRecord(doc.id)"
        target="_blank">Solr</a>
    </div>
  </div>
</template>

<script setup lang="js">
import { SupportedLang } from "../types/lang.js"
import { computed, onMounted } from "vue"
import {
  ensureKosTypeDefinitions,
  getKosTypeDescription,
  getKosTypeLabel,
} from "../constants/kosTypeDefinitions.js"
import { asStringArray } from "../utils/utils.js"
const envLabel = computed(() => {
  // local development (vite dev server)
  if (import.meta.env.DEV) {
    return "local"
  }

  // SSR guard: during server render there is no window
  if (typeof window === "undefined") {
    return "prod"
  }

  const host = window.location.hostname.toLowerCase()
  if (host === "dev.bartoc.org" || host.endsWith(".dev.bartoc.org")) {
    return "staging"
  }

  return "prod"
})

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

onMounted(() => {
  ensureKosTypeDefinitions()
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

// Legacy fallback labels already denormalized into the Solr document.
const typeLabel = computed(() => {
  const key = `type_label_${props.lang ?? "en"}`
  return asStringArray(rawDoc[key])
})

// Build the display model for KOS types from the canonical URI field.
//
// `type_uri` is multivalued: it usually contains the technical SKOS
// `ConceptScheme` URI plus one or more NKOS type URIs.
const typeItems = computed(() => {
  const items = asStringArray(rawDoc.type_uri)
    .map(uri => {
      const label = getKosTypeLabel(uri)
      if (!label) {
        return null
      }

      return {
        uri,
        label,
        description: getKosTypeDescription(uri),
      }
    })
    .filter(Boolean)

  // Prefer URI-backed items because they can show the generated NKOS tooltip.
  if (items.length) {
    return items
  }

  // Fall back to the old Solr label fields without tooltip metadata.
  return typeLabel.value.map(label => ({
    uri: "",
    label,
    description: "",
  }))
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
  `${import.meta.env.BASE_URL}api/data?uri=${encodeURIComponent(id)}&format=solr`

const getJskosRecord = id =>
  `${import.meta.env.BASE_URL}api/data?uri=${encodeURIComponent(id)}`

const titleHref = computed(() => {
  const id = props.doc?.id
  if (!id) {
    return "#"
  }

  // in staging/local, rewrite bartoc.org -> dev.bartoc.org
  if (envLabel.value === "staging" || envLabel.value === "local") {
    try {
      const u = new URL(id)
      if (u.hostname === "bartoc.org") {
        u.hostname = "dev.bartoc.org"
      }
      return u.toString()
    } catch {
      return id
    }
  }

  return id
})

</script>

<style>
.result-card {
  margin: var(--cc-space-md) 0;
  padding: var(--cc-row-padding-y) var(--cc-row-padding-x);
  text-align: left;
  color: var(--cc-color-text);

  background-color: var(--cc-color-surface);
  border: 1px solid var(--cc-border-color);
  border-radius: var(--cc-radius-md);

  border-left-width: 3px;
  border-left-style: solid;
  border-left-color: transparent;

  box-shadow: var(--cc-shadow-sm);

  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out,
    border-left-color 120ms ease-out,
    box-shadow 120ms ease-out,
    transform 80ms ease-out;
}

.result-card:hover {
  background-color: var(--cc-color-surface-muted);
  border-color: var(--cc-border-color-control);
  border-left-color: var(--cc-color-primary);
  box-shadow: var(--cc-shadow-md);
  transform: translateY(-1px);
}

.result-title {
  font-size: var(--cc-font-size-lg);
  margin: 0 0 var(--cc-space-sm);
  border-bottom: 1px dotted var(--cc-border-color);
  padding-bottom: var(--cc-space-xs);
}

.result-title a {
  color: var(--cc-color-primary);
  font-weight: var(--cc-font-weight-regular);
}

.result-title a.api-link {
  float: right;
  font-size: var(--cc-font-size-sm);
}

.result-description {
  font-size: var(--cc-font-size-sm);
  margin: var(--cc-space-sm) var(--cc-space-xs);
  color: var(--cc-color-muted);
}

.result-details {
  margin: var(--cc-space-xs);
  list-style: none;
  padding: 0;
}

.result-details li {
  font-size: var(--cc-font-size-sm);
  margin-bottom: var(--cc-space-xs);
}

.kos-type-list__item {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.kos-type-info {
  display: inline-flex;
  align-items: center;
  color: var(--cc-color-muted);
  cursor: help;
}

.kos-type-info:focus-visible {
  outline: 2px solid var(--cc-color-primary);
  outline-offset: 2px;
}

.result-metadata {
  border-top: 1px dotted var(--cc-border-color);
  font-size: var(--cc-font-size-sm);
  padding: var(--cc-space-xs) 0;
  margin-top: var(--cc-space-xs);
  color: var(--cc-color-muted);
}

.result-metadata * {
  margin-right: var(--cc-space-sm);
}

.highlighted {
  background: var(--cc-color-highlight);
  color: var(--cc-color-text);
}
</style>
