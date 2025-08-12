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

export interface SolrDocument
  extends TitleFields,
    DescriptionFields,
    TypeLabelFields {
  access_type_ss?: string[];
  address_country_s?: string;
  alt_labels_ss: string[];
  api_type_ss: string[];
  api_url_ss: string[];
  created_dt?: string;
  ddc_ss: string[];
  ddc_root_ss: string[]
  format_type_ss?: string[];
  format_group_ss?: string[];
  fullrecord: string;
  id: string;
  identifier_ss: string[];
  languages_ss: string[];
  license_type_ss?: string[];
  license_group_ss?: string[];
  listed_in_ss?: string[];
  modified_dt?: string;
  namespace_s?: string;
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
