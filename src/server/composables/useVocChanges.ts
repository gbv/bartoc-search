// src/vocChangesClient.ts
import WebSocket from "ws";
import dotenv from "dotenv";
import config from "../conf/conf";
import { SolrDeletePayload, SolrUpsertPayload } from "../types/solr";
import { terminologiesQueue } from "../queue/worker";
import { VocChangeEvent, OperationType } from "../types/ws";
import { VocChangeEventSchema } from "../validation/vocChangeEvent";

dotenv.config();
const WS_URL =
  (process.env.JSKOS_WS_URL ?? "ws://jskos-server:3000") + "/voc/changes";

// **Example buffering logic**: collect up to BATCH_SIZE docs then flush as one job
const BATCH_SIZE = config.solr.batchSize;
const BATCH_TIMEOUT =
  config.queues?.terminologiesQueue?.limiter?.duration ?? 1000;
const documentsBuffer: SolrUpsertPayload[] = [];

async function flushBuffer() {
  if (documentsBuffer.length === 0) return;

  // Remove everything from the buffer
  const batch = documentsBuffer.splice(0, documentsBuffer.length);

  // Map each payload to a BulkJobOptions<SolrJobPayload>
  const jobs = batch.map((payload) => ({
    name: payload.operation, // "create" | "update" | "replace"
    data: payload,
  }));

  // Pipeline them in one Redis call
  await terminologiesQueue.addBulk(jobs);
}

const flushInterval = setInterval(flushBuffer, BATCH_TIMEOUT);

export async function startVocChangesListener(): Promise<void> {
  const socket = new WebSocket(WS_URL);

  socket.on("open", () => {
    config.log?.(`[WS] Connected to ${WS_URL}`);
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
        await terminologiesQueue.add(payloadDelete.operation, payloadDelete); // Add job to solr queue for deleting
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

      config.error?.(`[WS] Error parsing message: ${message}`);
      config.error?.(`[WS] Raw payload was: ${data.toString()}`);
    }
  });

  socket.on("close", () => {
    config.warn?.("[WS] Connection closed. Reconnecting in 5s...");
    // Clean up our timer, then restart the listener
    clearInterval(flushInterval);
    setTimeout(() => startVocChangesListener(), 5000);
  });

  socket.on("error", (err) => {
    config.error?.("[WS] Error:", err.message);
    socket.close();
  });
}
