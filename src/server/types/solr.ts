// types/solr.ts
import { ConceptSchemeDocument } from "./jskos";
import { SupportedLang } from "./lang";
import { OperationType } from "./ws";

type TitleFields = {
  [K in SupportedLang as `title_${K}`]?: string;
};

type DescriptionFields = {
  [K in SupportedLang as `description_${K}`]?: string;
};

type TypeLabelFields = {
  [K in SupportedLang as `type_label_${K}`]?: string;
};



// Dynamic Solr field typing helpers

/**
 * Template for any per-language dynamic field emitted at ETL time.
 * Example (family = "altLabel"): "altLabel_en", "altLabel_de", "altLabel_und".
 * The resulting keys MUST match a Solr rule like:
 *   <dynamicField name="<family>_*" ... />
 */
export type FamilyKey<F extends string> = `${F}_${string}`;

/**
 * Sparse object whose keys are per-language dynamic fields (<family>_<lang>)
 * and whose values are the multi-valued strings written to Solr.
 * Example keys: "altLabel_en", "creator_label_de".
 */
export type PerLangOut<F extends string> = Partial<Record<FamilyKey<F>, string[]>>;

/**
 * Language-agnostic aggregate field, typically a multiValued `string` used for
 * facets, exact filters, and simple display (e.g., "alt_labels_ss").
 */
export type AggOut<A extends string> = Partial<Record<A, string[]>>;

/**
 * Convenience type that combines per-language dynamic fields with one aggregate
 * field for the same family (e.g., altLabel_* + alt_labels_ss).
 */
export type DynamicOut<F extends string, A extends string> = PerLangOut<F> & AggOut<A>;

/**
 * Adds a concrete URI bucket to the output (e.g., "contributor_uri_ss").
 * Value is a multi-valued list of canonical URIs.
 */
export type UriOut<U extends string> = { [K in U]?: string[] };


// Family-specific output shapes

/**
 * Contributor fields:
 * - `contributor_label_<lang>`  (dynamic, analyzed text; multi-valued)
 * - `contributor_labels_ss`     (aggregate across languages; multi-valued string)
 * - `contributor_uri_ss`        (URIs; multi-valued string)
 */
export type ContributorOut = DynamicOut<"contributor_label","contributor_labels_ss"> & UriOut<"contributor_uri_ss">;

/**
 * Creator fields:
 * - `creator_label_<lang>`  (dynamic, analyzed text; multi-valued)
 * - `creator_labels_ss`     (aggregate across languages; multi-valued string)
 * - `creator_uri_ss`        (URIs; multi-valued string)
 */
export type CreatorOut = DynamicOut<"creator_label","creator_labels_ss"> & UriOut<"creator_uri_ss">;

export type DistributionsOut = {
  distributions_download_ss?: string[];
  distributions_format_ss?: string[];
  distributions_mimetype_ss?: string[];
};

export interface SolrDocument
  extends TitleFields,
    DescriptionFields,
    TypeLabelFields {
  access_type_ss?: string[];
  address_code_s?: string;
  address_country_s?: string;
  address_locality_s?: string;
  address_region_s?: string;
  address_street_s?: string;
  api_type_ss: string[];
  api_url_ss: string[];
  contact_email_s?: string;
  display_hideNotation_b?: boolean;
  display_numericalNotation_b?: boolean;
  examples_ss?: string[];
  format_type_ss?: string[];
  format_group_ss?: string[];
  alt_labels_ss?: string[];
  contributor_ss?: string[];
  creator_ss?: string[];
  created_dt?: string;
  ddc_ss: string[];
  ddc_root_ss: string[];
  definition_ss?: string[];
  distributions_download_ss?: string[];
  distributions_format_ss?: string[];
  distributions_mimetype_ss?: string[];
  extent_s?: string;
  fullrecord: string;
  id: string;
  identifier_ss: string[];
  languages_ss: string[];
  license_type_ss?: string[];
  license_group_ss?: string[];
  listed_in_ss?: string[];
  modified_dt?: string;
  namespace_s?: string;
  notation_ss?: string[];
  notation_examples_ss?: string[];
  notation_pattern_s?: string;
  publisher_id: string;
  publisher_label: string;
  subject_notation: string[];
  subject_uri: string[];
  subject_scheme: string[];
  start_year_i?: number;
  title_sort?: string;
  type_uri: string[];
  url_s?: string;
}

// Not used
export interface SolrClient {
  add(doc: object | object[]): Promise<void>;
  commit(): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteByQuery(query: string): Promise<void>;
  // query(q: string, options?: QueryOptions): Promise<SolrResponse>;
  ping(): Promise<boolean>;
}

// Not used
export interface SolrPingResponse {
  status: string;
}

// Not used
export interface SolrSystemInfoResponse {
  lucene: Record<string, unknown>;
  jvm: Record<string, unknown>;
  solr_home: string;
}

// used in CollectionOperation.ts
export enum CollectionAction {
  CREATE = "CREATE",
  DELETE = "DELETE",
  RELOAD = "RELOAD",
  LIST = "LIST", // for Solr CLoud, i.e. GET /solr/admin/collections?action=LIST&wt=json
  STATUS = "STATUS", // for solr based on cores, i.e. GET /solr/admin/cores?action=STATUS&wt=json
  PING = "PING",
}

// use in index.ts
export interface PingResponse {
  status: string;
  QTime: number;
}

// Not used
export interface CollectionOperationQueryParams {
  action: CollectionAction;
  name?: string;
  config?: string;
  deleteInstanceDir?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface SolrSearchResponse {
  responseHeader: {
    status: number;
    QTime: number;
    params: Record<string, string>;
  };
  response: {
    numFound: number;
    start: number;
    docs: SolrDocument[];
    numFoundExact?: boolean;
  };
  // Optionally facets, spellcheck etc.
  facet_counts?: {
    facet_fields:  Record<string, Array<string|number>>;
    facet_queries: Record<string, number>;
  };
}

/**
 * Fields by which search results can be sorted.
 */
export enum SortField {
  RELEVANCE = "relevance",
  CREATED   = "created",
  MODIFIED  = "modified",
  TITLE = "title",
}


/**
 * Direction to apply when sorting.
 */
export enum SortOrder {
  ASC  = "asc",
  DESC = "desc",
}


/**
 * Parameters accepted by our search endpoint.
 * - `search`, `field`, and `limit` go to Solr.
 * - `sort`/`order` control the sort criteria.
 */
export interface SearchParams {
  search?: string; 
  field?: string; // e.g. "title", etc.
  limit?: number; // rows= sent to Solr
  sort?: SortField;
  order?: SortOrder;
  filters?: string;
  format?: string; // e.g. "jskos",
  uri?: string
}

/**
 * Map  SortField values to real Solr schema fields.
 */
export const SortFieldMap: Record<SortField, string> = {
  [SortField.RELEVANCE]: "score",
  [SortField.CREATED]:   "created_dt",
  [SortField.MODIFIED]:  "modified_dt",
  [SortField.TITLE]:     "title_sort", // This is a custom field for sorting titles
};

/**
 * Details provided when Solr returns an error.
 */
export interface SolrErrorDetail {
  /** Metadata about the error (e.g. exception classes). */
  metadata: string[];
  /** The main error message from Solr. */
  msg: string;
  /** HTTP-style error code returned by Solr (e.g. 400). */
  code: number;
  /** Any additional fields returned by Solr’s error payload. */
  [key: string]: unknown;
}

/**
 * A Solr response when an error occurs.
 */
export interface SolrErrorResponse {
  responseHeader: {
    status: number;
    QTime: number;
    params: Record<string, string>;
  };
  /** The error object describing what went wrong. */
  error: SolrErrorDetail;
}

/**
 * Union type for any Solr response: either a successful search or an error.
 */
export type SolrResponse = SolrSearchResponse | SolrErrorResponse;

export interface SolrStatusResult {
  connected: boolean;
  indexedRecords: number;
  lastIndexedAt: string | number | undefined;
}

interface BasePayload {
  id: string;
  receivedAt: number;
}

export interface SolrDeletePayload extends BasePayload {
  operation: OperationType.Delete;
  // no document field
}

export interface SolrUpsertPayload extends BasePayload {
  operation:
    | OperationType.Create
    | OperationType.Replace
    | OperationType.Update;
  document: ConceptSchemeDocument;
}

export type SolrJobPayload = SolrDeletePayload | SolrUpsertPayload;
