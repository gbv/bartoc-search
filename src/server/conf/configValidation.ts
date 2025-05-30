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
  batch_size: z.number(),
  host: z.string(),
  port: z.number(),
  url: z.string().optional(),
  version: z.number(),
});

// Full config schema
export const defaultConfigSchema = z.object({
  baseUrl: z.string().nullable().optional(),
  closedWorldAssumption: z.boolean().optional(),
  env: z.string().default("development"),
  indexDataAtBoot: z.boolean().optional(),
  loadNdjsonData: z.boolean().optional(),
  logLevel: z.string().default("info"),
  mongo: mongoSchema,
  ndJsonDataPath: z.string().optional(),
  port: z.number(),
  proxies: z.array(z.string()).optional(),
  solr: solrSchema,
  title: z.string().optional(),
  verbosity: verbositySchema.optional(),
  version: z.string().nullable().optional(),
});

// Partial user schema for validation
export const userConfigSchema = defaultConfigSchema.partial();

// App config
export type AppConfig = z.infer<typeof defaultConfigSchema>;
