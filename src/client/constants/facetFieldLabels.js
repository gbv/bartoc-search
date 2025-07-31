// src/constants/facetFieldLabels.js

// import { SUPPORTED_LANGUAGES } from "../../server/types/lang"
import { KOS_TYPE_LABELS} from "./kosTypeMapping"
import SUPPORTED_LANGUAGES from "../../../data/supported_languages.json"

/**
 * Human-friendly labels for facet field keys.
 * Maps the internal facet field names to display titles.
 */
export const FACET_FIELD_LABELS = {
  type_uri: {
    label: "Knowledge Organization System Type",
    values: KOS_TYPE_LABELS,
  },
  /* ddc_ss: {
    label: "Dewey Decimal Classification",
    values: {},
  }, */
  languages_ss:  {
    label: "Language",
    values: SUPPORTED_LANGUAGES,
  },
  publisher_label: {
    label: "Publisher",
    values: {},
  },
}
