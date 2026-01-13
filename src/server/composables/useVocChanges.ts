import WebSocket from "ws";
import config from "../conf/conf";
import { SolrUpsertPayload } from "../types/solr";
import { getTerminologiesQueue } from "../queue/worker";
import { normalizeWsMessage, shouldProcess, toOperationType, OperationType } from "../types/wsNormalized";
import { coerceConceptSchemeDocument } from "../utils/coerceConceptScheme";

const BATCH_SIZE = config.queues?.terminologiesQueue?.batchSize ?? 50;
const BATCH_TIMEOUT = config.queues?.terminologiesQueue?.limiter?.duration ?? 1000;
const empty: string = "<empty>";

const bufferById = new Map<string, SolrUpsertPayload>(); // for coalescing by id
const documentsBuffer: SolrUpsertPayload[] = [];

let flushInterval: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

let socket: WebSocket | null = null;
let starting = false;
let flushing = false;

/**
 * Connection + processing telemetry.
 * This is what you can expose on /api/status.
 */
const wsStatus = {
  url: config.WS_URL,

  connected: false,

  connectCount: 0,
  reconnectCount: 0,

  lastOpenAt: empty,
  lastCloseAt: empty,
  lastCloseCode: 0,
  lastCloseReason: "",

  lastErrorAt: empty,
  lastError: "",

  lastPingAt: empty,
  lastPongAt: empty,

  lastMessageAt: empty,

  receivedEvents: 0,
  enqueuedJobs: 0,
  enqueuedBatches: 0,
  legacySkipped: 0,

  lastEvent: null as null | { type: string; id?: string; receivedAt: string },
};

function toIso(ms: number) {
  return ms ? new Date(ms).toISOString() : empty;
}

export async function getWsStatus() {
  // bufferSize is dynamic, so compute it at read time
  return {
    ...wsStatus,
    bufferSize: documentsBuffer.length,
  };
}

// Backward compatible helper you already use in status.ts
export async function isWebsocketConnected(): Promise<boolean> {
  return wsStatus.connected;
}

// flushBuffer that coalesces by id
async function flushBuffer() {
  if (flushing) return;
  if (bufferById.size === 0) return;

  flushing = true;
  try {
    const batch = Array.from(bufferById.values());
    bufferById.clear();

    const jobs = batch.map((payload) => ({
      name: payload.operation,
      data: payload,
      opts: { removeOnComplete: false, removeOnFail: false },
    }));

    const queue = await getTerminologiesQueue();
    if (!queue) {
      config.error?.("terminologiesQueue unavailable: Redis not connected");
      // put back best-effort
      for (const p of batch) bufferById.set(p.id, p);
      return;
    }

    await queue.addBulk(jobs);
    config.log?.(`[WS] addBulk() queued ${jobs.length} jobs`);

    const counts = await queue.getJobCounts("wait", "active", "completed", "failed", "delayed");
    config.log?.(`[WS] queue counts: ${JSON.stringify(counts)}`);

    wsStatus.enqueuedBatches += 1;
    wsStatus.enqueuedJobs += jobs.length;
  } finally {
    flushing = false;
  }
}

function startFlushTimer() {
  if (flushInterval) clearInterval(flushInterval);
  flushInterval = setInterval(() => {
    void flushBuffer();
  }, BATCH_TIMEOUT);
}

function startHeartbeat(ws: WebSocket) {
  if (pingInterval) clearInterval(pingInterval);

  // Baseline: consider "alive" from now; pongs will update later
  wsStatus.lastPingAt = toIso(Date.now());

  pingInterval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return;

    wsStatus.lastPingAt = toIso(Date.now());
    ws.ping();
  }, 30_000);
}

function stopTimers() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = null;

  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  reconnectTimeout = null;
}

function scheduleReconnect() {
  if (reconnectTimeout) return; // already scheduled
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    void startVocChangesListener();
  }, 5000);
}

export async function startVocChangesListener(): Promise<void> {
  console.log("Starting VOC changes listener...");
  if (starting) return;
  starting = true;

  try {
    startFlushTimer();

    // Close previous socket if still around
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.close(1000, "restarting listener");
      } catch {
        /* ignore */
      }
    }

    socket = new WebSocket(config.WS_URL);

    socket.on("open", () => {
      // reconnectCount counts successful opens after the first one
      if (wsStatus.connectCount > 0) wsStatus.reconnectCount += 1;

      wsStatus.connected = true;
      wsStatus.connectCount += 1;
      wsStatus.lastOpenAt = toIso(Date.now());

      // Treat open as “alive”; pong will refine it
      wsStatus.lastPongAt = toIso(Date.now());

      config.log?.(`[WS] connected to ${config.WS_URL}`);
      startHeartbeat(socket!);
    });

    // ws emits 'pong' when it receives a pong reply to ping()
    socket.on("pong", () => {
      wsStatus.lastPongAt = toIso(Date.now());
    });

    socket.on("message", async (data) => {
      wsStatus.lastMessageAt = toIso(Date.now());

      const text = data.toString();
      let raw: unknown;

      try {
        raw = JSON.parse(text);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? (err.stack ?? err.message)
            : typeof err === "string"
              ? err
              : JSON.stringify(err);

        wsStatus.lastErrorAt = toIso(Date.now());
        wsStatus.lastError = message;

        config.error?.(`[WS] message parse error: ${message}`);
        config.error?.(`[WS] raw payload: ${text}`);
        return; // critical: don't continue
      }

      const ev = normalizeWsMessage(raw);
      if (!ev) return;

      // ignore legacy broadcasts (no type)
      if (!ev.op) {
        wsStatus.legacySkipped = (wsStatus.legacySkipped ?? 0) + 1;
        return;
      }

      if (!shouldProcess(ev)) return;

      const op = toOperationType(ev.op);
      config.log?.(
        `[WS] ${op} id=${ev.id} modified=${ev.modified ?? "<none>"} legacy=${ev.legacy}`,
      );

      wsStatus.receivedEvents += 1;
      wsStatus.lastEvent = {
        type: op,
        id: ev.id,
        receivedAt: toIso(Date.now()),
      };

      // TODO Delete: ignore for now (rare) or handle separately later
      if (op === OperationType.Delete) return;

      const doc = coerceConceptSchemeDocument(ev.doc);
      if (!doc) {
        config.warn?.(`[WS] skipping event id=${ev.id}: cannot coerce ConceptSchemeDocument`);
        return;
      }

      // Need a document for upsert
      if (!doc) {
        wsStatus.lastErrorAt = toIso(Date.now());
        wsStatus.lastError = "Missing document on non-delete event";
        config.warn?.(`[WS] skip: missing document for op=${op} id=${ev.id}`);
        return;
      }

      const upsert: SolrUpsertPayload = {
        operation: op,
        document: doc,
        id: ev.id,
        receivedAt: toIso(Date.now()),
      };

      // approach with coalescing
      bufferById.set(upsert.id, upsert);

      if (bufferById.size >= BATCH_SIZE) {
        await flushBuffer();
      }
    });


    socket.on("close", (code, reason) => {
      wsStatus.connected = false;
      wsStatus.lastCloseAt = toIso(Date.now());
      wsStatus.lastCloseCode = code;
      wsStatus.lastCloseReason = reason?.toString() || "";

      stopTimers();

      config.warn?.(
        `[WS] closed code=${code} reason=${wsStatus.lastCloseReason || "(none)"}; reconnecting in 5s...`,
      );

      scheduleReconnect();
    });

    socket.on("error", (err) => {
      wsStatus.connected = false;
      wsStatus.lastErrorAt = toIso(Date.now());
      wsStatus.lastError = err.message;

      stopTimers();
      config.error?.(`[WS] error: ${err.message}`);

      // Ensure close happens once; close will schedule reconnect
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    });
  } finally {
    starting = false;
  }
}
