import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConceptSchemeDocument } from "../../server/types/jskos";
import type { SolrDocument, SolrJobPayload } from "../../server/types/solr";
import { OperationType } from "../../server/types/wsNormalized";

const mocks = vi.hoisted(() => ({
  addDocuments: vi.fn(),
  deleteDocuments: vi.fn(),
  getMainRecordTitlesForEdition: vi.fn(),
  transformConceptSchemeToSolr: vi.fn(),
  getNkosConcepts: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../server/conf/conf", () => ({
  default: {
    solr: { coreName: "test-core" },
    log: mocks.log,
    warn: mocks.warn,
    error: mocks.error,
  },
}));

vi.mock("../../server/solr/solr", () => ({
  addDocuments: mocks.addDocuments,
  deleteDocuments: mocks.deleteDocuments,
  getMainRecordTitlesForEdition: mocks.getMainRecordTitlesForEdition,
  transformConceptSchemeToSolr: mocks.transformConceptSchemeToSolr,
}));

vi.mock("../../server/utils/nskosService", () => ({
  getNkosConcepts: mocks.getNkosConcepts,
}));

const RECEIVED_AT = "2026-01-03T10:00:00Z";

const document: ConceptSchemeDocument = {
  "@context": "https://gbv.github.io/jskos/context.json",
  uri: "http://bartoc.org/en/node/worker-upsert",
  prefLabel: { en: "Worker Upsert" },
  created: "2026-01-01T10:00:00Z",
  modified: "2026-01-02T10:00:00Z",
  type: ["http://www.w3.org/2004/02/skos/core#ConceptScheme"],
};

const solrDocument = {
  id: document.uri,
  fullrecord: JSON.stringify(document),
} as SolrDocument;

describe("processTerminologyJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    OperationType.Create,
    OperationType.Update,
    OperationType.Replace,
  ])("processes %s jobs as Solr upserts", async (operation) => {
    const nKosConcepts = [{ uri: "http://example.org/nkos-type" }];
    mocks.getNkosConcepts.mockReturnValue(nKosConcepts);
    mocks.transformConceptSchemeToSolr.mockReturnValue(solrDocument);

    const { processTerminologyJob } = await import(
      "../../server/queue/processTerminologyJob"
    );

    await processTerminologyJob({
      operation,
      id: document.uri,
      receivedAt: RECEIVED_AT,
      document,
    });

    expect(mocks.getNkosConcepts).toHaveBeenCalledTimes(1);
    expect(mocks.transformConceptSchemeToSolr).toHaveBeenCalledWith(
      document,
      nKosConcepts,
      undefined,
    );
    expect(mocks.addDocuments).toHaveBeenCalledWith("test-core", [solrDocument]);
    expect(mocks.deleteDocuments).not.toHaveBeenCalled();
  });

  it("processes delete jobs as Solr deletes", async () => {
    const { processTerminologyJob } = await import(
      "../../server/queue/processTerminologyJob"
    );

    await processTerminologyJob({
      operation: OperationType.Delete,
      id: document.uri,
      receivedAt: RECEIVED_AT,
    });

    expect(mocks.deleteDocuments).toHaveBeenCalledWith("test-core", [
      document.uri,
    ]);
    expect(mocks.getNkosConcepts).not.toHaveBeenCalled();
    expect(mocks.transformConceptSchemeToSolr).not.toHaveBeenCalled();
    expect(mocks.addDocuments).not.toHaveBeenCalled();
  });

  it("fails clearly when an upsert job has no document", async () => {
    const { processTerminologyJob } = await import(
      "../../server/queue/processTerminologyJob"
    );
    const payload = {
      operation: OperationType.Update,
      id: document.uri,
      receivedAt: RECEIVED_AT,
    } as SolrJobPayload;

    await expect(processTerminologyJob(payload)).rejects.toThrow(
      `Missing document for ${OperationType.Update} ${document.uri}`,
    );
    expect(mocks.getNkosConcepts).not.toHaveBeenCalled();
    expect(mocks.transformConceptSchemeToSolr).not.toHaveBeenCalled();
    expect(mocks.addDocuments).not.toHaveBeenCalled();
    expect(mocks.deleteDocuments).not.toHaveBeenCalled();
  });

  it("fails clearly for unsupported operations", async () => {
    const { processTerminologyJob } = await import(
      "../../server/queue/processTerminologyJob"
    );
    const payload = {
      operation: "archive",
      id: document.uri,
      receivedAt: RECEIVED_AT,
    } as unknown as SolrJobPayload;

    await expect(processTerminologyJob(payload)).rejects.toThrow(
      "Unsupported operation: archive",
    );
    expect(mocks.getNkosConcepts).not.toHaveBeenCalled();
    expect(mocks.transformConceptSchemeToSolr).not.toHaveBeenCalled();
    expect(mocks.addDocuments).not.toHaveBeenCalled();
    expect(mocks.deleteDocuments).not.toHaveBeenCalled();
  });
});
