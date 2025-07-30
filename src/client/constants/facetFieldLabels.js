// src/constants/facetFieldLabels.js

// import { SUPPORTED_LANGUAGES } from "../../server/types/lang"
import { KOS_TYPE_LABELS} from "./kosTypeMapping"
import SUPPORTED_LANGUAGES from "../../../data/supported_languages.json"

/**
 * Human-friendly labels for facet field keys.
 * Maps the internal facet field names to display titles.
 */
export const FACET_FIELD_LABELS = {
  languages_ss:  {
    label: "Language",
    values: SUPPORTED_LANGUAGES,
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
