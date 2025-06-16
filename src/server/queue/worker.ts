import { Worker, Job } from "bullmq";
import config from "../conf/conf";
import redisClient from "../redis/redis";
import { Queue } from "./queue";
import type { SolrDocument, SolrJobPayload } from "../types/solr";
import { OperationType } from "../types/ws";
import {
  addDocuments,
  deleteDocuments,
  transformConceptSchemeToSolr,
} from "../solr/solr";
import { getNkosConcepts } from "../utils/nskosService";

// Handler function that processes each Solr job
const solrHandler = async (job: Job<SolrJobPayload>): Promise<void> => {
  const { operation, id } = job.data;

  switch (operation) {
    case OperationType.Delete: {
      config.log?.(`[Worker] Deleting ${id} from Solr…`);
      await deleteDocuments("bartoc", [id]);
      config.log?.(`[Worker] delete completed for id=${id}`);
      break;
    }

    case OperationType.Create:
    case OperationType.Update:
    case OperationType.Replace: {
      const document = job.data.document;
      if (!document) {
        throw new Error(`Missing document for ${operation} ${id}`);
      }
      config.log?.(`[Worker] ${operation} ${id} in Solr…`);
      // Upsert as JSON document(s)
      const nKosConcepts = getNkosConcepts();
      const solrDoc: SolrDocument = transformConceptSchemeToSolr(
        document,
        nKosConcepts,
      );
      await addDocuments("bartoc", [solrDoc]);
      config.log?.(`[Worker] ${operation} completed for id=${id}`);
      break;
    }

    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
};

// Initialize (or retrieve) the BullMQ queue
export const solrQueue = Queue<SolrJobPayload>("solrQueue");

// Create a separate Worker for that queue, attaching the solrHandler
export const solrWorker = new Worker<SolrJobPayload>(
  solrQueue.name,
  solrHandler,
  {
    connection: redisClient,
    concurrency: config.queues?.solrQueue.concurrency ?? 5,
  },
);

// Optional: Listen to worker events for logging
solrWorker.on("completed", (job) => {
  config.log?.(`[Worker] Job ${job.id} has completed`);
});

solrWorker.on("failed", (job, err) => {
  config.error?.(`[Worker] Job ${job?.id} failed: ${err.message}`);
});
