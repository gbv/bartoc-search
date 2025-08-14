// Validating schema with zod
import { z } from "zod";

// reference is https://gbv.github.io/jskos/#list
const jskosListSchema = z
  .array(z.string().min(1).or(z.literal(null)))
  .optional()
  .refine(
    list => !list || list.filter(x => x === null).length <= 1 && (
      list[list.length - 1] === null || !list.includes(null)
    ),
    {
      message: "If `null` is used, it must appear only once and only as the last item."
    }
  );

const displaySchema = z.object({
  hideNotation: z.boolean().optional(),
  numericalNotation: z.boolean().optional(),
}).strict();

export const conceptSchemeZodSchema = z.object({
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
  API: z.array(z.object({ 
    type: z.string().url(), 
    url: z.string().url(),
  }))
    .optional(),
  CONTACT: z.string().email().optional(),
  DISPLAY: displaySchema.optional(),
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
  identifier: jskosListSchema,
  languages: z.array(z.string()).optional(),
  namespace: z.string().url().optional(),
  modified: z.string(),
  created: z.string(),
  partOf: z.array(z.object({uri: z.string().url(),}),).optional(),
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

export type ConceptSchemeZodType = z.infer<typeof conceptSchemeZodSchema>;
