// src/constants/facetFieldLabels.js

import { reactive } from "vue"
import { KOS_TYPE_LABELS} from "./kosTypeMapping"
import SUPPORTED_LANGUAGES from "../../../data/supported_languages.json"
import { ensureLabels } from "./facetLabels"

// Dynamic label sources  build from the snapshot.
const DYNAMIC_FACETS = {
  access_type_ss: { file: "access_type.json", label: "Access Type" },
  ddc_root_ss: { file: "ddc-labels.json", label: "Dewey Decimal Classification" },
  listed_in_ss: { file: "listed_in.json", label: "Register" },
  api_type_ss: { file: "bartoc-api-types-labels.json", label: "Api Type" },
}

const dynamicFacets = {}
for (const [key, cfg] of Object.entries(DYNAMIC_FACETS)) {
  dynamicFacets[key] = { label: cfg.label, values: {} }
}

/**
 * Human-friendly labels for facet field keys.
 * Maps the internal facet field names to display titles.
 */
export const FACET_FIELD_LABELS = reactive({
  type_uri: {
    label: "Knowledge Organization System Type",
    values: KOS_TYPE_LABELS,
  },
  languages_ss: {
    label: "Language",
    values: SUPPORTED_LANGUAGES,
  },
  format_group_ss: {
    label: "Format Group",
    values: {},
  },
  license_group_ss: {
    label: "License Group",
    values: {},
  },
  address_country_s: {
    label: "Country",
    values: {},
  },
  ...dynamicFacets,
})

const baseUrl = import.meta.env.BASE_URL || "/"

// Client-only: load each dynamic JSON once and merge into the same object reference.
let _labelsReady = Promise.resolve()
if (typeof window !== "undefined") {
  _labelsReady = Promise.all(
    Object.entries(DYNAMIC_FACETS).map(async ([facet, cfg]) => {
      const target = FACET_FIELD_LABELS[facet].values
      const obj = await ensureLabels(facet, `${baseUrl}data/${cfg.file}`)
      Object.assign(target, obj || {})
    }),
  )
}

export const dynamicFacetLabelsReady = _labelsReady