// types/solr.ts
import { SupportedLang } from "./lang";

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
  alt_labels_ss: string[];
  created_dt?: string;
  ddc_ss: string[];
  id: string;
  languages_ss: string[];
  modified_dt?: string;
  publisher_id: string;
  publisher_label: string;
  subject_notation: string[];
  subject_uri: string[];
  subject_scheme: string[];
  start_year_i?: number;
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
