import { z } from "zod";

export const mongoOptionsSchema = z.object({
  connectTimeoutMS: z.number().optional(),
  heartbeatFrequencyMS: z.number().optional(),
  socketTimeoutMS: z.number().optional(),
});

export const mongoSchema = z.object({
  db: z.string(),
  host: z.string(),
  options: mongoOptionsSchema.optional(),
  pass: z.string().optional(),
  port: z.number(),
  user: z.string().optional(),
});

export const solrSchema = z.object({
  batch_size: z.number(),
  host: z.string(),
  port: z.number(),
  url: z.string().optional(),
  version: z.number(),
});

export const configSchema = z.object({
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
  verbosity: z
    .union([
      z.literal("log"),
      z.literal("warn"),
      z.literal("error"),
      z.boolean(),
    ])
    .optional(),
  version: z.string().nullable().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;
