// src/server/types/wsNormalized.ts

// keep the same 4 operations used by Solr + queues
export const OperationType = {
  Create: "create",
  Update: "update",
  Replace: "replace",
  Delete: "delete",
} as const;

export type OperationType = typeof OperationType[keyof typeof OperationType];

// WS op is the same union type
export type WsOp = OperationType;

// Typed set, built from the canonical constants (no duplicated strings)
export const WS_OPS: ReadonlySet<WsOp> = new Set<WsOp>([
  OperationType.Create,
  OperationType.Update,
  OperationType.Replace,
  OperationType.Delete,
]);

// A tiny type-guard (no Zod needed, ever get rid of that dependency in the future)
export function isWsOp(x: unknown): x is WsOp {
  return (
    x === OperationType.Create ||
    x === OperationType.Update ||
    x === OperationType.Replace ||
    x === OperationType.Delete
  );
}

export function toOperationType(op?: WsOp): OperationType {
  return op ?? OperationType.Update;
}


function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function isStr(x: unknown): x is string {
  return typeof x === "string";
}
function getStr(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return isStr(v) && v.length ? v : undefined;
}

type Normalized = {
  id: string;
  op?: WsOp; // optional because legacy messages have no type
  doc?: unknown;
  modified?: string;
  legacy: boolean;
};

export function normalizeWsMessage(raw: unknown): Normalized | null {
  if (!isObj(raw)) return null;

  // Only care about ConceptScheme events
  if (raw.objectType !== "ConceptScheme") return null;

  const doc = isObj(raw.document) ? raw.document : undefined;

  // Determine id: raw.id > doc.uri > doc._id
  const id =
    getStr(raw, "id") ??
    (doc ? (getStr(doc, "uri") ?? getStr(doc, "_id")) : undefined);

  if (!id) return null;

  // Determine op (optional): must be one of allowed ops
  const t = getStr(raw, "type");
  const op = t && WS_OPS.has(t as WsOp) ? (t as WsOp) : undefined;

  // Determine modified (best effort): prefer doc.modified, fallback raw.modified
  const modified =
    (doc ? getStr(doc, "modified") : undefined) ?? getStr(raw, "modified");

  return {
    id,
    op,
    doc,
    modified,
    legacy: !op,
  };
}


const lastModifiedById = new Map<string, number>();

function parseMs(iso?: string) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

const seenTypedById = new Set<string>();

export function shouldProcess(ev: Normalized) {
  const cur = parseMs(ev.modified);
  const prev = lastModifiedById.get(ev.id) ?? 0;

  // Legacy (no op/type): accept only if we never saw a typed event for this id
  if (!ev.op) {
    if (seenTypedById.has(ev.id)) return false;
    if (!cur) return false;
    if (cur <= prev) return false;
    lastModifiedById.set(ev.id, cur);
    return true;
  }

  // Typed: always mark as typed
  seenTypedById.add(ev.id);

  // If no modified: accept (can't dedupe safely)
  if (!cur) return true;

  // Dedupe by modified
  if (cur <= prev) return false;

  lastModifiedById.set(ev.id, cur);
  return true;
}


