import { Worker, Job } from "bullmq";
import config from "../conf/conf";
import redisClient from "../redis/redis";
import { Queue } from "./queue";
import type { SolrJobPayload } from "../types/solr";
import { OperationType } from "../types/ws";

// Handler function that processes each Solr job
const solrHandler = async (job: Job<SolrJobPayload>): Promise<void> => {
  const { operation, id } = job.data;

  switch (operation) {
    case OperationType.Delete: {
      // Remove document by id from Solr
      // await config.solrClient.delete("id", id);
      // await config.solrClient.commit();
      config.log?.(`[Worker] delete completed for id=${id}`);
      break;
    }

    case OperationType.Create:
    case OperationType.Update:
    case OperationType.Replace: {
      const document = job.data.document;
      // Add or update document in Solr
      // await config.solrClient.add(document);
      // await config.solrClient.commit();
      config.log?.(`[Worker] ${operation} completed for id=${document.uri}`);
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
