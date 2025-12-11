// src/constants/sort.js

// What the user sees in the dropdown
export const SORT_OPTIONS = [
  { key: "relevance",    label: "Relevance" },
  { key: "created desc", label: "Created latest" },
  { key: "created asc",  label: "Created first" },
  { key: "modified desc",label: "Modified latest" },
  { key: "modified asc", label: "Modified first" },
  { key: "title asc",    label: "Title (A–Z)" },
  { key: "title desc",   label: "Title (Z–A)" },
]

// How each option maps to Solr fields
export const SORT_KEY_TO_SOLR = {
  relevance:       { sort: "relevance", order: "desc" },
  "created desc":  { sort: "created",   order: "desc" },
  "created asc":   { sort: "created",   order: "asc"  },
  "modified desc": { sort: "modified",  order: "desc" },
  "modified asc":  { sort: "modified",  order: "asc"  },
  "title asc":     { sort: "title",     order: "asc"  },
  "title desc":    { sort: "title",     order: "desc" },
}

// Defaults
export const DEFAULT_SORT_KEY = "relevance"
export const DEFAULT_SORT     = "relevance"
export const DEFAULT_ORDER    = "desc"
