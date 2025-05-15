import { z } from "zod";

export const nKosTypeConceptSchema = z.object({
  "@context": z.string(),

  uri: z.string().url(),

  type: z.array(z.string()),

  inScheme: z.array(
    z.object({
      uri: z.string().url(),
      prefLabel: z.record(z.string()),
      type: z.array(z.string()),
    }),
  ),

  publisher: z
    .array(
      z.object({
        prefLabel: z.record(z.string()),
      }),
    )
    .optional(),

  notation: z.array(z.string()),

  prefLabel: z.record(z.string()),

  altLabel: z.record(z.array(z.string())).optional(),

  scopeNote: z.record(z.array(z.string())).optional(),

  topConceptOf: z.array(
    z.object({
      uri: z.string().url(),
      prefLabel: z.record(z.string()),
      type: z.array(z.string()),
    }),
  ),
});

export type NkosZodTypeConcept = z.infer<typeof nKosTypeConceptSchema>;
