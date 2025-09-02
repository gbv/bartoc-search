// src/constants/facetFieldLabels.js

// import { SUPPORTED_LANGUAGES } from "../../server/types/lang"
import { KOS_TYPE_LABELS} from "./kosTypeMapping"
import SUPPORTED_LANGUAGES from "../../../data/supported_languages.json"
import { ensureLabels } from "./facetLabels"

// Dynamic label sources  build from the snapshot.
const DYNAMIC_FACETS = {
  access_type_ss: { file: "access_type.json", label: "Access Type" },
  ddc_root_ss: { file: "ddc-labels.json", label: "Dewey Decimal Classification" },
  listed_in_ss: { file: "listed_in.json", label: "Listed In" },
  api_type_ss: { file: "bartoc-api-types-labels.json", label: "Api Type" },
  format_group_ss: { file: "format-groups.json", label: "Format Group" },
}

const dynamicFacets = {}
for (const [key, cfg] of Object.entries(DYNAMIC_FACETS)) {
  dynamicFacets[key] = { label: cfg.label, values: {} }
}

/**
 * Human-friendly labels for facet field keys.
 * Maps the internal facet field names to display titles.
 */
export const FACET_FIELD_LABELS = {
  type_uri: {
    label: "Knowledge Organization System Type",
    values: KOS_TYPE_LABELS,
  },
  languages_ss:  {
    label: "Language",
    values: SUPPORTED_LANGUAGES,
  },
  license_group_ss: {
    label: "License Group",
    values: {},
  },
  address_country_s: {
    label: "Country",
    values: {}, 
  },
  publisher_labels_ss: {
    label: "Publisher",
    values: {},
  },
  ...dynamicFacets,
}


const baseUrl = import.meta.env.BASE_URL || "/"

// Client-only: load each dynamic JSON once and merge into the same object reference.
if (typeof window !== "undefined") {
  for (const [facet, cfg] of Object.entries(DYNAMIC_FACETS)) {
    const target = FACET_FIELD_LABELS[facet].values // stable reference used in UI
    ensureLabels(facet, `${baseUrl}data/${cfg.file}`).then(obj => {
      Object.assign(target, obj || {}) // mutate in place → no need to replace references
    })
  }
}