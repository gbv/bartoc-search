import { Queue as BullQueue } from "bullmq";
import config from "../conf/conf";
import { redisConnection, connectToRedis, workersEnabled } from "../redis/redis";

//Generics per for every kind of Job payload
type RegisteredQueue<T> = {
  queue: BullQueue<T>;
};

// Extend the global namespace so we can store a singleton map of queues and workers
// We use a var here intentionally to attach to the global object
declare global {
  // A registry mapping queue names to their instances (queue + worker)

   
  var __registeredQueues: Record<string, RegisteredQueue<unknown>> | undefined;
}

// On first import, initialize the global registry if it doesn't exist
if (!global.__registeredQueues) {
  global.__registeredQueues = {};
}

// Create a local reference to the global registry for convenience
const registeredQueues = global.__registeredQueues;

/**
 * Create (or return) a singleton BullMQ queue.
 * Returns null when workers/Redis are disabled or unreachable.
 * ---
 * Key knobs:
 *  - defaultJobOptions.attempts/backoff
 *  - removeOnComplete/removeOnFail to clean up old jobs
 */
export async function Queue<Payload>(
  name: string,
): Promise<BullQueue<Payload> | null> {

  if (!workersEnabled()) {
    config.log?.(`Queue "${name}" not started: workers disabled`);
    return null;
  }

  // If the queue already exists, return the existing instance
  if (registeredQueues[name]) {
    config.log?.(`Queue "${name}" already initialized`);
    return (registeredQueues[name] as RegisteredQueue<Payload>).queue;
  }

  // Try to connect to Redis first
  try {
    await connectToRedis();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    config.log?.(`Queue "${name}" not started: Redis unreachable (${message})`);
    return null;
  }

  // Create the queue with default retry/backoff options
  const queue = new BullQueue<Payload>(name, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: { count: 1000 },
    },
  });

  // Register in the global map as unknown, to be cast upon retrieval
  registeredQueues[name] = { queue } as RegisteredQueue<unknown>;

  config.log?.(`Queue "${name}" initialized`);

  return queue;
}
