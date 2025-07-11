import { ConceptSchemeDocument, ConceptDocument } from "./jskos"
import { objectTypes } from "jskos-tools"

export enum OperationType {
  Create = "create",
  Update = "update",
  Replace = "replace",
  Delete = "delete",
}

/**
 * The “objectType” values we expect from the WS server.
 */
export type ObjectType = keyof typeof objectTypes;

/** Special case: a delete event has no objectType or document payload. */
export interface DeleteChangeEvent {
  id: string;
  type: OperationType.Delete;
}

/**
 * Base fields common to all change events.
 */
interface BaseChangeEvent {
  objectType: ObjectType;
  id: string;
  type: OperationType;
}

/**
 * A change event where the payload is a full ConceptScheme.
 */
export interface ConceptSchemeChangeEvent extends BaseChangeEvent {
  objectType: "ConceptScheme";
  document: ConceptSchemeDocument;
}

/**
 * A change event where the payload is a single Concept (nkostype).
 */
export interface ConceptChangeEvent extends BaseChangeEvent {
  objectType: "Concept";
  document: ConceptDocument;
}

/**
 * Union of all the change‐event shapes we might receive.
 */
export type VocChangeEvent =
  | ConceptSchemeChangeEvent
  | ConceptChangeEvent
  | DeleteChangeEvent;
