import { z } from "zod";

// Verbosity type
const verbositySchema = z.union([
  z.literal("log"),
  z.literal("warn"),
  z.literal("error"),
  z.boolean(),
]);

// MongoOptions schema
export const mongoOptionsSchema = z.object({
  connectTimeoutMS: z.number().optional(),
  socketTimeoutMS: z.number().optional(),
  heartbeatFrequencyMS: z.number().optional(),
});

// MongoConfig schema
export const mongoSchema = z.object({
  user: z.string().optional(),
  pass: z.string().optional(),
  host: z.string(),
  port: z.number(),
  db: z.string(),
  options: mongoOptionsSchema.optional(),
  auth: z.string().optional(),
  url: z.string().optional(),
});

// SolrConfig schema
export const solrSchema = z.object({
  batchSize: z.number(),
  coreName: z.string(),
  host: z.string(),
  pingTimeout: z.number().optional(),
  pingRetries: z.number().optional(),
  pingRetryDelay: z.number().optional(),
  port: z.number(),
  url: z.string().optional(),
  version: z.number(),
});

export const redisSchema = z.object({
  host: z.string(),
  pingTimeout: z.number().optional(),
  pingRetries: z.number().optional(),
  pingRetryDelay: z.number().optional(),
  port: z.number(),
  url: z.string().optional(),
});

// A schema for the rate‐limiter settings
const LimiterSchema = z.object({
  // max number of jobs to start in each window
  max: z.number().int().nonnegative(),
  // window duration in milliseconds
  duration: z.number().int().nonnegative(),
});

export const QueueConfigSchema = z.object({
  // concurrency must be a positive integer if provided
  concurrency: z.number().int().positive().optional(),
  // optional rate limiter
  limiter: LimiterSchema.optional(),
});

export const WebSocketConfigSchema = z.object({
  host: z.string(),
  port: z.number().optional(),
  path: z.string(),
  pingTimeout: z.number().optional(),
  pingRetries: z.number().optional(),
  pingRetryDelay: z.number().optional(),
});

// Full config schema
export const defaultConfigSchema = z.object({
  baseUrl: z.string().nullable().optional(),
  closedWorldAssumption: z.boolean().optional(),
  env: z.string().default("development"),
  indexDataAtBoot: z.boolean().optional(),
  logLevel: z.string().default("info"),
  mongo: mongoSchema.optional(),
  ndJsonDataPath: z.string().optional(),
  port: z.number(),
  proxies: z.array(z.string()).optional(),
  queues: z.record(QueueConfigSchema).optional(),
  redis: redisSchema,
  solr: solrSchema,
  title: z.string().optional(),
  verbosity: verbositySchema.optional(),
  version: z.string().nullable().optional(),
  webSocket: WebSocketConfigSchema.optional(),
});

// Partial user schema for validation
export const userConfigSchema = defaultConfigSchema.partial();

// App config
export type AppConfig = z.infer<typeof defaultConfigSchema>;
