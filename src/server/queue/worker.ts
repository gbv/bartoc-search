import { Worker, Job } from "bullmq";
import config from "../conf/conf";
import { Queue } from "./queue";
import type {
  SolrDocument,
  SolrJobPayload,
  SolrDeletePayload,
  SolrUpsertPayload,
} from "../types/solr";
import { OperationType } from "../types/ws";
import {
  addDocuments,
  deleteDocuments,
  transformConceptSchemeToSolr,
} from "../solr/solr";
import { getNkosConcepts } from "../utils/nskosService";

// Initialize (or retrieve) the BullMQ queue (async)
const terminologiesQueuePromise = Queue<SolrJobPayload>("terminologiesQueue");
export async function getTerminologiesQueue() {
  return await terminologiesQueuePromise;
}

async function startWorker() {
  const terminologiesQueue = await terminologiesQueuePromise;
  if (!terminologiesQueue) {
    config.error?.("terminologiesQueue not started: Redis unavailable");
    return;
  }

  // Pull concurrency & rate‐limiter from config
  const qc = config.queues?.terminologiesQueue;
  const workerOpts = {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      lazyConnect: true,
      enableOfflineQueue: false, // <- no buffering: immediate error if disconnected
    },
    concurrency: qc?.concurrency ?? 20,
    limiter: qc?.limiter ?? { max: 100, duration: 1000 },
  };

  // Create a separate Worker for that queue, attaching the solrHandler
  const terminologiesWorker = new Worker<SolrJobPayload>(
    terminologiesQueue.name,
    async (job: Job<SolrJobPayload>) => {
      const data = job.data;
      const { operation, id } = data as SolrUpsertPayload | SolrDeletePayload;
      switch (operation) {
        case OperationType.Delete:
          config.log?.(`[Worker] Deleting ${id} from Solr…`);
          await deleteDocuments(config.solr.coreName, [id]);
          config.log?.(`[Worker] delete completed for id=${id}`);
          break;
        case OperationType.Create:
        case OperationType.Update:
        case OperationType.Replace: {
          const upsert = data as SolrUpsertPayload;
          if (!upsert.document)
            throw new Error(`Missing document for ${operation} ${id}`);
          config.log?.(`[Worker] ${operation} ${id} in Solr…`);
          const nKosConcepts = getNkosConcepts();
          const solrDocument: SolrDocument = transformConceptSchemeToSolr(
            upsert.document,
            nKosConcepts,
          );
          await addDocuments(config.solr.coreName, [solrDocument]);
          config.log?.(`[Worker] ${operation} completed for id=${id}`);
          break;
        }
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    },
    workerOpts,
  );

  // Optional: hook metrics or detailed logging here
  terminologiesWorker.on("completed", (job) => {
    config.log?.(
      `[Worker] Job ${job.id} completed in ${job.finishedOn! - job.processedOn!}ms`,
    );
  });

  terminologiesWorker.on("failed", (job, err) => {
    config.error?.(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });
}

startWorker();
