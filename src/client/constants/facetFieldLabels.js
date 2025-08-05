// src/constants/facetFieldLabels.js

// import { SUPPORTED_LANGUAGES } from "../../server/types/lang"
import { KOS_TYPE_LABELS} from "./kosTypeMapping"
import SUPPORTED_LANGUAGES from "../../../data/supported_languages.json"
import DDC_LABELS from "../../../data/ddc-labels.json"
import LISTED_IN_LABELS from "../../../data/listedIn.json"
import API_TYPE_LABELS from "../../../data/bartoc-api-types-labels.json"
import ACCESS_TYPE_LABELS from "../../../data/access_type.json"

/**
 * Human-friendly labels for facet field keys.
 * Maps the internal facet field names to display titles.
 */
export const FACET_FIELD_LABELS = {
  type_uri: {
    label: "Knowledge Organization System Type",
    values: KOS_TYPE_LABELS,
  },
  ddc_root_ss: {
    label: "Dewey Decimal Classification",
    values: DDC_LABELS,
  },
  languages_ss:  {
    label: "Language",
    values: SUPPORTED_LANGUAGES,
  },
  listed_in_ss: {
    label: "Listed in",
    values: LISTED_IN_LABELS,
  },
  api_type_ss: {
    label: "Api Type", 
    values: API_TYPE_LABELS,
  },
  access_type_ss: {
    label: "Access Type",
    values: ACCESS_TYPE_LABELS,
  },
  license_group_ss: {
    label: "License Group",
    values: {},
  },
  format_group_ss: {
    label: "Format Group",
    values: {},
  },
  address_country_s: {
    label: "Country",
    values: {}, 
  },
  publisher_label: {
    label: "Publisher",
    values: {},
  },
}
