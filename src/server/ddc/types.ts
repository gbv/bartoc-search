import { LastMeta } from "../utils/updateFromBartoc";

/**
 * Simple language map for labels, e.g.:
 *   { en: "Canada", de: "Kanada" }
 */
export type LangMap = Record<string, string>;

/**
 * Lightweight reference to another DDC concept.
 *
 * This is used for:
 *   - ancestors  (broader chain)
 *   - memberSet  (component notations, e.g. table numbers)
 */
export interface DdcRef {
  uri: string;
  /** Optional human-readable labels in multiple languages */
  prefLabel?: LangMap;
  /** Optional notation(s), e.g. ["440"] */
  notation?: string[];
}

/**
 * Enriched in-memory representation of a DDC concept.
 *
 * It is built from the raw JSKOS snapshot in DdcStore:
 *   - `ancestors` is the full broader chain (top-down),
 *   - `memberSet` contains resolved component concepts.
 *
 */
export interface DdcConcept {
  uri: string;
  notation?: string[];
  prefLabel?: LangMap;
  /** Broader chain, top-down: immediate ancestor first, root last */
  ancestors?: DdcRef[];
  /** Atomic building blocks, e.g. table numbers from memberSet */
  memberSet?: DdcRef[];
}

/**
 * Result of expanding one or more DDC concepts for Solr indexing.
 *
 * It contains:
 *   - numeric notations (roots, ancestors, exact classes)
 *   - label buckets used for scoring and display.
 */
export interface DdcExpansion {
  /** Root notations, e.g. "4", "8" */
  roots: string[];
  /** Non-root ancestor notations, e.g. "44", "84" */
  ancestors: string[];
  /** Main class notations, e.g. "440", "818" */
  exact: string[];
  labels: {
    /** Main concept labels (one per assigned DDC class) */
    rank1: string[];
    /** Immediate ancestor + memberSet labels */
    rank2: string[];
    /** Root ancestor labels (most general classes) */
    rank3: string[];
  };
}

/**
 * Metadata stored next to the DDC snapshot.
 *
 * Extends `LastMeta` used by other snapshots with DDC-specific fields.
 */
export type DdcLastMeta = LastMeta & {
  /** Absolute or relative path to the last DDC snapshot file */
  snapshotPath?: string;
  /** HTTP ETag from the last download (for conditional requests) */
  etag?: string;
  /** Last-Modified header from the last download, if available */
  lastModified?: string;
};
