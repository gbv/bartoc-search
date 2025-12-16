import WebSocket from "ws";
import config from "../conf/conf";
import { SolrDeletePayload, SolrUpsertPayload } from "../types/solr";
import { getTerminologiesQueue } from "../queue/worker";
import { VocChangeEvent, OperationType } from "../types/ws";
import { VocChangeEventSchema } from "../validation/vocChangeEvent";

// **Example buffering logic**: collect up to BATCH_SIZE docs then flush as one job
const BATCH_SIZE = config.solr.batchSize;
const BATCH_TIMEOUT =
  config.queues?.terminologiesQueue?.limiter?.duration ?? 1000;
const documentsBuffer: SolrUpsertPayload[] = [];

async function flushBuffer() {
  if (documentsBuffer.length === 0) {
    return;
  }

  // Remove everything from the buffer
  const batch = documentsBuffer.splice(0, documentsBuffer.length);

  // Map each payload to a BulkJobOptions<SolrJobPayload>
  const jobs = batch.map((payload) => ({
    name: payload.operation, // "create" | "update" | "replace"
    data: payload,
  }));

  // Get the queue instance
  const queue = await getTerminologiesQueue();
  if (!queue) {
    config.error?.("terminologiesQueue unavailable: Redis not connected");
    return;
  }
  // Pipeline them in one Redis call
  await queue.addBulk(jobs);
}

const flushInterval = setInterval(flushBuffer, BATCH_TIMEOUT);
let isVocChangesConnected: boolean = false;

export async function isWebsocketConnected(): Promise<boolean> {
  return isVocChangesConnected;
}

export async function startVocChangesListener(): Promise<void> {
  const socket = new WebSocket(config.WS_URL);

  socket.on("open", () => {
    isVocChangesConnected = true;
    config.log?.(`[WS] Websocket connected to ${config.WS_URL}`);
  });

  socket.on("message", async (data) => {
    try {
      const dataRaw = JSON.parse(data.toString());
      const event: VocChangeEvent = VocChangeEventSchema.parse(dataRaw); // throws error if invalid
      config.log?.("[WS] Change received:", event.type);

      if (event.type === OperationType.Delete) {
        // DeleteChangeEvent has no `document`
        const payloadDelete: SolrDeletePayload = {
          operation: OperationType.Delete,
          id: event.id,
          receivedAt: Date.now(),
        };
        const queue = await getTerminologiesQueue();
        if (!queue) {
          config.error?.("terminologiesQueue unavailable: Redis not connected");
          return;
        }
        await queue.add(payloadDelete.operation, payloadDelete); // Add job to solr queue for deleting
        return;
      }

      // 6) Buffer upsert payloads for bulk enqueue
      const upsert: SolrUpsertPayload = {
        operation: event.type,
        document: event.document!,
        id: event.id,
        receivedAt: Date.now(),
      };
      documentsBuffer.push(upsert);

      config.log?.(
        `[Buffer] Added upsert for id=${upsert.id} (buffer=${documentsBuffer.length})`,
      );

      // If we’ve hit our size threshold, flush immediately
      if (documentsBuffer.length >= BATCH_SIZE) {
        await flushBuffer();
      }
    } catch (err: unknown) {
      // Normalize to an Error, then grab the message or fallback to a string
      const message =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === "string"
            ? err
            : JSON.stringify(err);

      config.error?.(`[WS] Websocket Error parsing message: ${message}`);
      config.error?.(`[WS] Websocket Raw payload was: ${data.toString()}`);
    }
  });

  socket.on("close", () => {
    isVocChangesConnected = false;
    config.warn?.("[WS] Websocket Connection closed. Reconnecting in 5s...");
    // Clean up our timer, then restart the listener
    clearInterval(flushInterval);
    setTimeout(() => startVocChangesListener(), 5000);
  });

  socket.on("error", (err) => {
    isVocChangesConnected = false;
    config.error?.("[WS] Websocket Error:", err.message);
    socket.close();
  });
}
