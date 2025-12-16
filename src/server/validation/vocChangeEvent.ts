import { z } from "zod";
import { OperationType } from "../types/ws";
import { conceptSchemeZodSchema } from "./conceptScheme";
export const OperationTypeSchema = z.nativeEnum(OperationType);

// A schema just for delete events (no objectType or document)
const DeleteEventSchema = z.object({
  id: z.string(),
  type: z.literal(OperationType.Delete),
});

// 2) A helper for the non‐delete operation values
const NonDeleteOperation = z.union([
  z.literal(OperationType.Create),
  z.literal(OperationType.Update),
  z.literal(OperationType.Replace),
]);

// 3) The two “document” event schemas, discriminated on objectType
const ConceptSchemeEvent = z.object({
  objectType: z.literal("ConceptScheme"),
  id: z.string(),
  type: NonDeleteOperation,
  document: conceptSchemeZodSchema,
});

// Take into account later
/* const ConceptEvent = z.object({
  objectType: z.literal("Concept"),
  id: z.string(),
  type: NonDeleteOperation,
  document: conceptZodSchema,
}); */

// 4) Union them all together
export const VocChangeEventSchema = z.union([
  DeleteEventSchema,
  ConceptSchemeEvent,
]);

// TS type for your validated payload
export type VocChangeEvent = z.infer<typeof VocChangeEventSchema>;
