// src/validation/vocChangeEvent.ts
import { z } from "zod";
import { OperationType } from "../types/ws";
import { conceptSchemeZodSchema } from "./conceptScheme";
import { conceptZodSchema } from "./concept";

// Re-use your TS enum at runtime for validation:
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

// (Add more variants here if you have more TS interfaces...)

// 3) The two “document” event schemas, discriminated on objectType
const ConceptSchemeEvent = z.object({
  objectType: z.literal("ConceptScheme"),
  id: z.string(),
  type: NonDeleteOperation,
  document: conceptSchemeZodSchema,
});

const ConceptEvent = z.object({
  objectType: z.literal("Concept"),
  id: z.string(),
  type: NonDeleteOperation,
  document: conceptZodSchema,
});

// 4) Union them all together
export const VocChangeEventSchema = z.union([
  DeleteEventSchema,
  ConceptSchemeEvent,
  ConceptEvent,
]);

// TS type for your validated payload
export type VocChangeEvent = z.infer<typeof VocChangeEventSchema>;
