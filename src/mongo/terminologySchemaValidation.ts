// Validating schema with zod
import { z } from "zod";

export const terminologyZodSchema = z.object({
  "@context": z.string(),
  ACCESS: z.array(z.object({ uri: z.string().url() })).optional(),
  ADDRESS: z
    .object({
      code: z.string().optional(),
      country: z.string().optional(),
      locality: z.string().optional(),
      region: z.string().optional(),
      street: z.string().optional(),
    })
    .optional(),
  FORMAT: z.array(z.object({ uri: z.string().url() })).optional(),
  altLabel: z.record(z.array(z.string())).optional(),
  contributor: z
    .array(
      z.object({
        prefLabel: z.object({ en: z.string().optional() }),
        uri: z.string().url(),
      }),
    )
    .optional(),
  creator: z
    .array(
      z.object({
        prefLabel: z.object({ en: z.string().optional() }),
        uri: z.string().url(),
      }),
    )
    .optional(),
  definition: z.record(z.array(z.string())).optional(),
  languages: z.array(z.string()).optional(),
  modified: z.string(),
  created: z.string(),
  prefLabel: z.record(z.string()),
  publisher: z
    .array(
      z.object({
        prefLabel: z.object({ en: z.string().optional() }),
        uri: z.string().url(),
      }),
    )
    .optional(),
  startDate: z.string().optional(),
  subject: z
    .array(
      z.object({
        inScheme: z.array(z.object({ uri: z.string().url() })).optional(),
        notation: z.array(z.string()).optional(),
        uri: z.string().url(),
      }),
    )
    .optional(),
  type: z.array(z.string()),
  uri: z.string().url(),
  url: z.string().url().optional(),
});

export type TerminologyZodType = z.infer<typeof terminologyZodSchema>;
