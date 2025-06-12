import { Queue as BullQueue } from "bullmq";
import config from "../conf/conf";
import redisClient from "../redis/redis";

//Generics per for every kind of Job payload
type RegisteredQueue<T> = {
  queue: BullQueue<T>;
};

// Extend the global namespace so we can store a singleton map of queues and workers
// We use a var here intentionally to attach to the global object
declare global {
  // A registry mapping queue names to their instances (queue + worker)

  // eslint-disable-next-line no-var
  var __registeredQueues: Record<string, RegisteredQueue<unknown>> | undefined;
}

// On first import, initialize the global registry if it doesn't exist
if (!global.__registeredQueues) {
  global.__registeredQueues = {};
}

// Create a local reference to the global registry for convenience
const registeredQueues = global.__registeredQueues;

/**
 * Creates (or returns) a singleton BullMQ queue.
 * @param name - the name of the queue
 * @returns the BullQueue instance, newly created or pre-existing
 */
export function Queue<Payload>(name: string): BullQueue<Payload> {
  // If the queue already exists, return the existing instance
  if (registeredQueues[name]) {
    config.log?.(`Queue "${name}" already initialized`);
    return (registeredQueues[name] as RegisteredQueue<Payload>).queue;
  }

  // Create the queue with default retry/backoff options
  const queue = new BullQueue<Payload>(name, {
    connection: redisClient,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
    },
  });

  // Register in the global map as unknown, to be cast upon retrieval
  registeredQueues[name] = { queue } as RegisteredQueue<unknown>;

  config.log?.(`Queue "${name}" initialized`);

  return queue;
}
