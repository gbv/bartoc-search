import { SolrStatusResult } from "../types/solr";

export interface StatusResponse {
  ok: boolean;
  appVersion: string;
  runtimeInfo: StatusRuntimeInfo;
  services: {
    mongo: { connected: boolean };
    solr: SolrStatusResult;
  };
}

export interface StatusRuntimeInfo {
  nodeVersion: string;
  uptime: string;
  memoryUsage: object;
  environment: string;
  timestamp: string;
}
