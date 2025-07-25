// src/constants/facetFieldLabels.js

import { LANGUAGE_NAMES } from "./languageMapping"
import { KOS_TYPE_LABELS} from "./kosTypeMapping"

/**
 * Human-friendly labels for facet field keys.
 * Maps the internal facet field names to display titles.
 */
export const FACET_FIELD_LABELS = {
  languages_ss:  {
    label: "Language",
    values: LANGUAGE_NAMES,
  },
  // add more facet fields here as needed
  type_uri: {
    label: "Kos Type",
    values: KOS_TYPE_LABELS,
  },
  publisher_label: {
    label: "Publisher",
    values: {},
  },
}
