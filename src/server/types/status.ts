import { SolrStatusResult } from "../types/solr"
export interface StatusResponse {
  ok: boolean;
  config: {
    env: string;
    serverVersion: string;
    title: string;
  };
  solr: SolrStatusResult;
  jskosServer: { connected: boolean };
}
