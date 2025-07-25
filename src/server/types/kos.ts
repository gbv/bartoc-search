// types/kos.ts

/**
 * The high-level KOS groups, per ISKO 4.1
 */
export enum KOSGroup {
  TermLists       = "Term Lists",
  Directories     = "Directories",
  Hierarchies     = "Hierarchies",
  SemanticSystems = "Semantic Systems",
  Others          = "Others",
}

/**
 * A map from each KOSGroup to the corresponding Solr facet.query string.
 */
export type KOSGroupQueryMap = Record<KOSGroup, string>;

/**
 * The actual facet.query definitions, keyed by KOSGroup.
 */
export const KOS_GROUP_QUERIES: KOSGroupQueryMap = {
  [KOSGroup.TermLists]: [
    "http://w3id.org/nkos/nkostype#dictionary",
    "http://w3id.org/nkos/nkostype#list",
    "http://w3id.org/nkos/nkostype#glossary",
    "http://w3id.org/nkos/nkostype#synonym_ring"
  ]
    .map(uri => `type_uri:"${uri}"`)
    .join(" OR "),

  [KOSGroup.Directories]: [
    "http://w3id.org/nkos/nkostype#gazetteer",
    "http://w3id.org/nkos/nkostype#name_authority_list"
  ]
    .map(uri => `type_uri:"${uri}"`)
    .join(" OR "),

  [KOSGroup.Hierarchies]: [
    "http://w3id.org/nkos/nkostype#subject_heading_scheme",
    "http://w3id.org/nkos/nkostype#categorization_schema",
    "http://w3id.org/nkos/nkostype#classification_schema",
    "http://w3id.org/nkos/nkostype#taxonomy"
  ]
    .map(uri => `type_uri:"${uri}"`)
    .join(" OR "),

  [KOSGroup.SemanticSystems]: [
    "http://w3id.org/nkos/nkostype#thesaurus",
    "http://w3id.org/nkos/nkostype#semantic_network",
    "http://w3id.org/nkos/nkostype#ontology"
  ]
    .map(uri => `type_uri:"${uri}"`)
    .join(" OR "),

  // catch‐all for deprecated/misc “terminology”
  [KOSGroup.Others]:
    'type_uri:"http://w3id.org/nkos/nkostype#terminology"',
};
