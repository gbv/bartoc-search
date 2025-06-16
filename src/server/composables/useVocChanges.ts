// src/vocChangesClient.ts
import WebSocket from "ws";
import dotenv from "dotenv";
import config from "../conf/conf";
import { SolrJobPayload, SolrDeletePayload } from "../types/solr";
import { terminologiesQueue } from "../queue/worker";
import { VocChangeEvent, OperationType } from "../types/ws";
import { VocChangeEventSchema } from "../validation/vocChangeEvent";

dotenv.config();
const WS_URL =
  (process.env.JSKOS_WS_URL ?? "ws://jskos-server:3000") + "/voc/changes";

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

      const doc = event.document;
      const payload: SolrJobPayload = {
        operation: event.type,
        document: doc,
        id: event.id,
        receivedAt: Date.now(),
      };
      await terminologiesQueue.add(payload.operation, payload); // Add job to solr queue
      config.log?.(`[Queue] Enqueued ${event.type} for id=${payload.id}`);
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
    setTimeout(() => startVocChangesListener(), 5000);
  });

  socket.on("error", (err) => {
    config.error?.("[WS] Error:", err.message);
    socket.close();
  });
}
