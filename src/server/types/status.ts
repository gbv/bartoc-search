import type { SolrStatusResult } from "../types/solr";

export interface WebSocketStatus {
  connected: boolean;

  connectCount: number;
  reconnectCount: number;

  lastOpenAt: string;
  lastCloseAt: string;
  lastCloseCode: number;
  lastCloseReason: string;

  lastErrorAt: string;
  lastError: string;

  lastPingAt: string;
  lastPongAt: string;

  lastMessageAt: string;

  receivedEvents: number;
  enqueuedJobs: number;
  enqueuedBatches: number;

  bufferSize: number;

  lastEvent: null | { type: string; id?: string; receivedAt: string };
}

export interface StatusResponse {
  ok: boolean;
  config: {
    env: string;
    serverVersion: string;
    title: string;
  };
  solr: SolrStatusResult;

  // keep backward compatibility:
  jskosServer: {
    connected: boolean;

    // optional, so old clients won't break
    ws?: WebSocketStatus;

    healthy?: boolean;
  };
}




