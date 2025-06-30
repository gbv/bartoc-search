import { SolrStatusResult } from "../types/solr";

export interface StatusResponse {
  ok: boolean;
  appVersion: string;
  environment: string;
  runtimeInfo: StatusRuntimeInfo;
  services: {
    solr: SolrStatusResult;
  };
}

export interface StatusRuntimeInfo {
  nodeVersion: string;
  uptime: string;
  memoryUsage: object;
  timestamp: string;
}
