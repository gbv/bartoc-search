<template>
  <div class="result-card">
    <header class="result-heading">
      <div class="result-heading__main">
        <button
          v-if="typeIcon && typeTooltip"
          type="button"
          class="kos-type-badge kos-type-badge--described"
          :class="{
            'kos-type-badge--open': tooltipOpen,
            'kos-type-badge--dismissed': tooltipDismissed,
          }"
          :aria-label="`About ${typeItems.map(type => type.label).join(', ')}`"
          :aria-describedby="typeTooltipId"
          @click="toggleTypeTooltip"
          @blur="closeTypeTooltip"
          @mouseenter="tooltipDismissed = false"
          @keydown.esc.stop="dismissTypeTooltip">
          <font-awesome-icon
            :icon="typeIcon"
            class="kos-type-icon"
            aria-hidden="true" />
          <span
            :id="typeTooltipId"
            class="kos-type-tooltip"
            role="tooltip">{{ typeTooltip }}</span>
        </button>
        <span
          v-else-if="typeIcon"
          class="kos-type-badge"
          aria-hidden="true">
          <font-awesome-icon
            :icon="typeIcon"
            class="kos-type-icon" />
        </span>
        <div class="result-heading__text">
          <h2 class="result-title">
            <a :href="titleHref">
              <template v-if="jskosRecord">
                <ItemName
                  :item="jskosRecord"
                  :language="lang"
                  :show-notation="false"
                  :draggable="false" />
                <span v-if="titleNotation"> ({{ titleNotation }})</span>
              </template>
              <template v-else>{{ fallbackTitle }}</template>
            </a>
          </h2>
          <div
            v-if="typeItems.length || doc.version_of_s"
            class="result-heading__context">
            <span
              v-if="typeItems.length"
              class="kos-type-list">
              <template
                v-for="(type, index) in typeItems"
                :key="type.uri || type.label">
                <span
                  class="kos-type-list__item"
                  :title="!typeIcon ? type.description || undefined : undefined"
                  :aria-label="!typeIcon && type.description ? `${type.label}: ${type.description}` : undefined"
                  :tabindex="!typeIcon && type.description ? 0 : undefined">
                  {{ type.label }}
                </span>
                <span v-if="index < typeItems.length - 1">, </span>
              </template>
            </span>
            <span
              v-if="typeItems.length && doc.version_of_s"
              class="result-heading__separator"
              aria-hidden="true">·</span>
            <span
              v-if="doc.version_of_s"
              class="result-edition-parent">
              <font-awesome-icon
                :icon="faCodeBranch"
                class="edition-context-icon"
                aria-hidden="true" />
              Edition of: <a
                :href="recordHref(doc.version_of_s)">{{ parentTitle || `BARTOC ${doc.version_of_s.split('/').pop()}` }}</a>
            </span>
          </div>
        </div>
      </div>
      <a
        v-if="jskosRecord?.API?.length || doc.api_url_ss?.length"
        class="api-link"
        :href="titleHref + '#content'">Content</a>
    </header>
    <p
      v-if="description"
      class="result-description">
      {{ description }}
    </p>
    <ul class="result-details">
      <li v-if="languageCodes.length">
        <strong>{{ languageCodes.length === 1 ? 'Language' : 'Languages' }}:</strong>{{ ` ${languageLabels.join(', ')}` }}
      </li>
      <li v-if="subjectList.length">
        <strong>Subjects: </strong>{{ subjectList.join(', ') }}
      </li>
      <li v-if="publisherLabels.length">
        <strong>Published by </strong>{{ publisherLabels.join(', ') }}
      </li>
      <li v-if="accessLabels.length">
        <strong>Access: </strong>{{ accessLabels.join(', ') }}
      </li>
      <li v-if="licenseItems.length">
        <strong>{{ licenseItems.length === 1 ? 'License' : 'Licenses' }}: </strong>
        <template
          v-for="(license, index) in licenseItems"
          :key="license.uri || index">
          <span v-if="index">, </span>
          <a
            v-if="license.href"
            :href="license.href"
            target="_blank"
            rel="noopener noreferrer">{{ license.label }}</a>
          <span v-else>{{ license.label }}</span>
        </template>
      </li>
      <li v-if="formatLabels.length">
        <strong>Format: </strong>{{ formatLabels.join(', ') }}
      </li>
    </ul>
    <div
      v-if="editions?.total > 0"
      class="result-editions">
      <strong>Editions ({{ editions.total }})</strong>
      <ul>
        <li
          v-for="edition in editions.items"
          :key="edition.uri">
          <a
            class="edition-preview-link"
            :href="recordHref(edition.uri)">{{ edition.title }}<span v-if="edition.startDate"> ({{ edition.startDate.slice(0, 4) }})</span></a>
        </li>
      </ul>
      <a
        v-if="editions.total > editions.items.length"
        class="edition-view-all"
        :href="recordHref(doc.id) + '#editions'">View all {{ editions.total }} editions</a>
    </div>
    <div class="result-metadata noprint">
      <span
        v-if="doc.created_dt"
        :class="{ highlighted: sort == 'created' }">
        created {{ doc.created_dt.replace(/[T ].*/,"") }}
      </span>
      <span
        v-if="doc.modified_dt"
        :class="{ highlighted: sort == 'modified' }">
        {{ doc.created_dt ? "· " : "" }}modified {{ doc.modified_dt.replace(/[T ].*/,"") }}
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
import { computed, onMounted, ref, useId } from "vue"
import { ItemName } from "jskos-vue"
import * as jskos from "jskos-tools"
import { faAddressBook, faCodeBranch, faListUl, faShareNodes, faSitemap } from "@fortawesome/free-solid-svg-icons"
import SUPPORTED_LANGUAGES from "../../../data/supported_languages.json"
import LICENSE_GROUPS from "../../../data/license-groups.json"
import FORMAT_GROUPS from "../../../data/format-groups.json"
import { FACET_FIELD_LABELS } from "../constants/facetFieldLabels.js"
import { KOS_TYPE_LABELS } from "../constants/kosTypeMapping.js"
import {
  ensureKosTypeDefinitions,
  getKosTypeDescription,
  getKosTypeLabel,
} from "../constants/kosTypeDefinitions.js"
import { asStringArray } from "../utils/utils.js"

// Label links for the local, staging, or production environment.
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
    // Accept only language codes supported by the application.
    validator: (v) => Object.values(SupportedLang).includes(v),
  },
  sort: { type: String },
  editions: { type: Object, default: null },
  parentTitle: { type: String, default: "" },
})

onMounted(() => {
  // Load NKOS labels and descriptions after the component mounts.
  ensureKosTypeDefinitions()
})

// Parse the indexed JSKOS record, returning null when it is absent or malformed.
const jskosRecord = computed(() => {
  if (typeof props.doc?.fullrecord !== "string") {
    return null
  }

  try {
    // Decode the JSON and require a record URI before exposing it to the view.
    const record = JSON.parse(props.doc.fullrecord)
    return typeof record?.uri === "string" && record.uri.trim() ? record : null
  } catch {
    return null
  }
})

// Put notation after the label, e.g. "Basic Classification (BK)".
// Respect the display flag and avoid adding it twice.
const titleNotation = computed(() => {
  const record = jskosRecord.value
  if (!record || record.DISPLAY?.hideNotation) {
    return ""
  }

  const notation = jskos.notation(record)
  const label = jskos.prefLabel(record, { language: props.lang }) || ""
  return notation && !label.toLowerCase().includes(`(${notation.toLowerCase()})`)
    ? notation
    : ""
})

// Fall back to the selected-language Solr title when it is missing.
const fallbackTitle = computed(() =>
  props.doc?.[`title_${props.lang ?? "en"}`] || props.doc?.id || "",
)

// Read and normalize the description from JSKOS or its Solr fallback.
const description = computed(() => {
  const definitions = jskosRecord.value
    ? jskos.definition(jskosRecord.value, { language: props.lang })
    : props.doc?.[`definition_${props.lang}`]
  const text = asStringArray(definitions)[0]?.trim() || ""
  return text.replace(/^"/, "").trimStart()
})

// Use Solr language codes only when the JSKOS record is unavailable.
const languageCodes = computed(() => asStringArray(
  jskosRecord.value ? jskosRecord.value.languages : props.doc?.languages_ss,
))

// Show readable names when available and retain unknown codes as a fallback.
const languageLabels = computed(() => languageCodes.value.map(code =>
  SUPPORTED_LANGUAGES[code] || code,
))

// Prefer publisher names from JSKOS, falling back to Solr labels if needed.
const publisherLabels = computed(() => {
  const publishers = Array.isArray(jskosRecord.value?.publisher)
    ? jskosRecord.value.publisher
    : []
  const labels = publishers
    .map(referenceLabel)
    .filter(Boolean)
  return labels.length ? labels : asStringArray(props.doc?.publisher_labels_ss)
})

// Read references from JSKOS, using indexed URI fields only when it is unreadable.
function references(field, solrField) {
  if (jskosRecord.value) {
    return Array.isArray(jskosRecord.value[field]) ? jskosRecord.value[field] : []
  }
  return asStringArray(props.doc?.[solrField]).map(uri => ({ uri }))
}

// Read a reference label without ever exposing its URI as a label.
function referenceLabel(item) {
  return jskos.prefLabel(item, { language: props.lang, fallbackToUri: false })
}

// Match group data across HTTP/HTTPS variants used by stored records.
function matchingGroup(groups, uri) {
  const httpUri = uri.replace(/^https:/, "http:")
  return groups.find(group => group.uris.includes(uri) || group.uris.includes(httpUri))
}

// Prefer facet or JSKOS labels; use a generic label for unknown access URIs.
const accessLabels = computed(() => references("ACCESS", "access_type_ss")
  .map(item => {
    const uri = item?.uri
    return FACET_FIELD_LABELS.access_type_ss.values[uri]
      || referenceLabel(item)
      || (webHref(uri) ? "Other access conditions" : "")
  })
  .filter(Boolean))

// Return a usable URL only for web links.
function webHref(uri) {
  try {
    return ["http:", "https:"].includes(new URL(uri).protocol) ? uri : ""
  } catch {
    return ""
  }
}

// Preserve useful license names and versions, then fall back to group labels.
function licenseLabel(item) {
  const preferred = referenceLabel(item)
  if (preferred) {
    return preferred
  }

  const uri = item.uri
  const ccLicense = /^https?:\/\/creativecommons\.org\/licenses\/([a-z-]+)\/([0-9.]+)\/?$/.exec(uri)
  if (ccLicense) {
    return `CC ${ccLicense[1].toUpperCase()} ${ccLicense[2]}`
  }

  const publicDomain = /^https?:\/\/creativecommons\.org\/publicdomain\/(zero|mark)\/([0-9.]+)\/?$/.exec(uri)
  if (publicDomain) {
    return publicDomain[1] === "zero"
      ? `CC0 ${publicDomain[2]}`
      : `Public Domain Mark ${publicDomain[2]}`
  }

  const group = matchingGroup(LICENSE_GROUPS, uri)
  return group?.label || "View terms"
}

// Prepare license labels and safe link targets for the card.
const licenseItems = computed(() => references("license", "license_type_ss")
  .filter(item => typeof item?.uri === "string" && item.uri)
  .map(item => ({
    uri: item.uri,
    href: webHref(item.uri),
    label: licenseLabel(item),
  })))

// Use JSKOS labels or compact group names, showing each format label once.
const formatLabels = computed(() => [...new Set(references("FORMAT", "format_type_ss")
  .filter(item => typeof item?.uri === "string" && item.uri)
  .map(item => {
    const uri = item.uri
    const group = matchingGroup(FORMAT_GROUPS, uri)
    return referenceLabel(item)
      || group?.key
      || (webHref(uri) ? "Other format" : "")
  })
  .filter(Boolean))])

// Legacy fallback labels are already denormalized into the Solr document.
const typeLabel = computed(() => {
  const key = `type_label_${props.lang ?? "en"}`
  return asStringArray(props.doc?.[key])
})

// Prefix shared by NKOS concept URIs used for labels, descriptions, and icons.
const NKOS_TYPE_PREFIX = "http://w3id.org/nkos/nkostype#"

// Build KOS types from JSKOS; use indexed URIs if fullrecord is unusable.
//
// The type list usually contains the technical SKOS `ConceptScheme` URI plus
// one or more NKOS type URIs. Static NKOS labels avoid a delayed text shift;
// loaded definitions can replace them and add tooltip descriptions.
const typeUris = computed(() => asStringArray(
  jskosRecord.value ? jskosRecord.value.type : props.doc?.type_uri,
))

// Resolve visible type labels from JSKOS and use Solr labels as a fallback.
const typeItems = computed(() => {
  const items = typeUris.value
    .map(uri => {
      const label = getKosTypeLabel(uri)
        || (uri.startsWith(NKOS_TYPE_PREFIX) ? KOS_TYPE_LABELS[uri] : "")
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

  // A readable record is authoritative, even when its types are unknown here.
  if (jskosRecord.value || items.length) {
    return items
  }

  // Older Solr documents may have labels without usable type URIs.
  return typeLabel.value.map(label => ({
    uri: "",
    label,
    description: "",
  }))
})

// Assign shared icons to related NKOS types; unsettled types stay iconless.
const KOS_TYPE_ICONS = {
  dictionary: faListUl,
  glossary: faListUl,
  list: faListUl,
  synonym_ring: faListUl,
  gazetteer: faAddressBook,
  name_authority_list: faAddressBook,
  categorization_schema: faSitemap,
  classification_schema: faSitemap,
  taxonomy: faSitemap,
  thesaurus: faShareNodes,
  semantic_network: faShareNodes,
  ontology: faShareNodes,
}

// Show one icon only when all NKOS types map to the same icon group.
const typeIcon = computed(() => {
  const types = typeUris.value.filter(uri => uri.startsWith(NKOS_TYPE_PREFIX))
  const icons = types.map(uri => KOS_TYPE_ICONS[uri.slice(NKOS_TYPE_PREFIX.length)])
  return icons.length && icons.every(Boolean) && new Set(icons).size === 1 ? icons[0] : null
})

// The icon represents all displayed types, so its tooltip includes each
// available type description instead of arbitrarily choosing one.
const typeTooltip = computed(() => typeItems.value
  .filter(({ description }) => description)
  .map(({ label, description }) => `${label}: ${description}`)
  .join("\n"))

// Link the tooltip to its trigger for assistive technology.
const typeTooltipId = useId()
// Track whether the tooltip is currently open.
const tooltipOpen = ref(false)
// Prevent Escape from being immediately overridden by hover or focus.
const tooltipDismissed = ref(false)

// Toggle the type description when its icon is activated.
function toggleTypeTooltip() {
  tooltipDismissed.value = false
  tooltipOpen.value = !tooltipOpen.value
}

// Hide the type description when its trigger loses focus.
function closeTypeTooltip() {
  tooltipOpen.value = false
  tooltipDismissed.value = false
}

// Let Escape dismiss the type description until focus changes.
function dismissTypeTooltip() {
  tooltipOpen.value = false
  tooltipDismissed.value = true
}

// Read the selected-language subject facet as an array.
const subjectList = computed(() => {
  const key = `subject_${props.lang}`
  const val = props.doc?.[key]
  return Array.isArray(val) ? val : []
})

// Build the URL for the Solr representation of a record.
const getSolrRecord = id =>
  `${import.meta.env.BASE_URL}api/data?uri=${encodeURIComponent(id)}&format=solr`

// Build the URL for the JSKOS representation of a record.
const getJskosRecord = id =>
  `${import.meta.env.BASE_URL}api/data?uri=${encodeURIComponent(id)}`

// Point record links to the matching development site outside production.
const recordHref = (id) => {
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
}

// Resolve the card title link from the current record URI.
const titleHref = computed(() => recordHref(props.doc?.id))

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

.result-card:hover,
.result-card:focus-within {
  position: relative;
  z-index: 1;
}

.result-heading {
  display: flex;
  justify-content: space-between;
  gap: var(--cc-space-sm);
  margin-bottom: var(--cc-space-sm);
  border-bottom: 1px solid var(--cc-border-color-control);
  padding-bottom: var(--cc-space-sm);
}

.result-heading__main {
  display: flex;
  align-items: center;
  gap: var(--cc-space-sm);
  flex: 1 1 auto;
  min-width: 0;
}

.result-heading__text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.result-heading__context {
  color: var(--cc-color-muted);
  font-size: var(--cc-font-size-sm);
}

.result-heading__separator {
  margin-inline: var(--cc-space-xs);
}

.edition-context-icon {
  color: var(--cc-color-primary);
  margin-inline-end: var(--cc-space-xs);
  font-size: var(--cc-font-size-lg);
}

@media (max-width: 767px) {
  .result-heading__separator {
    display: none;
  }

  .result-edition-parent {
    display: block;
  }

  .kos-type-list ~ .result-edition-parent {
    margin-top: var(--cc-space-xs);
  }
}

.result-title {
  font-size: var(--cc-font-size-lg);
  margin: 0 0 var(--cc-space-xs);
}

.result-title a {
  color: var(--cc-color-primary);
  font-weight: var(--cc-font-weight-bold);
}

.result-heading .api-link {
  flex: 0 0 auto;
  font-size: var(--cc-font-size-sm);
  white-space: nowrap;
}

.kos-type-list {
  color: var(--cc-color-text);
  font-size: var(--cc-font-size-sm);
  font-weight: var(--cc-font-weight-bold);
}

.kos-type-badge {
  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 3rem;
  width: 3rem;
  height: 3rem;
  padding: 0;
  color: var(--cc-color-primary);
  background: var(--cc-color-surface);
  border: 2px solid var(--cc-border-color-strong);
  border-radius: 50%;
  font: inherit;
}

.kos-type-icon {
  font-size: var(--cc-font-size-xl);
}

.kos-type-badge--described,
.kos-type-list__item[title] {
  cursor: help;
}

.kos-type-tooltip {
  position: absolute;
  top: calc(100% + var(--cc-space-xs));
  left: 0;
  z-index: 2;
  width: max-content;
  max-width: min(28rem, calc(100vw - 3rem));
  padding: var(--cc-space-sm);
  color: var(--cc-color-text);
  background: var(--cc-color-surface);
  border: 1px solid var(--cc-border-color-strong);
  border-radius: var(--cc-radius-sm);
  box-shadow: var(--cc-shadow-md);
  font-size: var(--cc-font-size-sm);
  font-weight: var(--cc-font-weight-light);
  line-height: 1.4;
  text-align: left;
  white-space: pre-line;
  visibility: hidden;
  opacity: 0;
}

.kos-type-badge--open .kos-type-tooltip,
.kos-type-badge--described:not(.kos-type-badge--dismissed):focus-visible .kos-type-tooltip {
  visibility: visible;
  opacity: 1;
}

@media (hover: hover) {
  .kos-type-badge--described:not(.kos-type-badge--dismissed):hover .kos-type-tooltip {
    visibility: visible;
    opacity: 1;
  }
}

.result-description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  overflow: hidden;
  font-size: var(--cc-font-size-base);
  line-height: 1.5;
  margin: var(--cc-space-sm) 0;
}

.result-details {
  margin: var(--cc-space-xs) 0;
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

.kos-type-badge:focus-visible,
.kos-type-list__item:focus-visible {
  outline: 2px solid var(--cc-color-primary);
  outline-offset: 2px;
}

.result-editions {
  margin: var(--cc-space-sm) 0;
  font-size: var(--cc-font-size-sm);
}

.result-editions ul {
  margin: var(--cc-space-xs) 0 0;
  padding: 0;
  list-style: none;
}

.result-editions li + li {
  margin-top: var(--cc-space-xs);
}

.edition-view-all {
  display: inline-block;
  margin-top: var(--cc-space-xs);
}

.result-metadata {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--cc-space-xs) var(--cc-space-sm);
  border-top: 1px solid var(--cc-border-color-control);
  font-size: var(--cc-font-size-sm);
  padding: var(--cc-space-xs) 0;
  margin-top: var(--cc-space-xs);
  color: var(--cc-color-muted);
}

.highlighted {
  background: var(--cc-color-highlight);
  color: var(--cc-color-text);
}
</style>
