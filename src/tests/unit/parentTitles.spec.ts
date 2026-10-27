import axios from "axios";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getParentTitles } from "../../server/solr/parentTitles";
import type { SolrDocument } from "../../server/types/solr";

vi.mock("../../server/conf/conf", () => ({
  default: { solr: { coreName: "test", url: "http://solr.invalid/solr" }, warn: vi.fn() },
}));

const request = vi.spyOn(axios, "request");
const first = "http://bartoc.org/en/node/1";
const second = "http://bartoc.org/en/node/2";

describe("getParentTitles", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: { response: { docs: [] } } });
  });
  afterAll(() => request.mockRestore());

  it("skips Solr when there are no parents", async () => {
    expect(await getParentTitles([{ id: first }] as SolrDocument[])).toEqual({});
    expect(request).not.toHaveBeenCalled();
  });

  it("deduplicates parents and prefers English over the fallback title", async () => {
    request.mockResolvedValueOnce({ data: { response: { docs: [
      { id: first, title_en: "English", title_sort: "Fallback" },
      { id: second, title_sort: "Other title" },
      { id: "untitled" },
    ] } } });

    const docs = [first, first, second].map(version_of_s => ({ version_of_s })) as SolrDocument[];
    expect(await getParentTitles(docs)).toEqual({ [first]: "English", [second]: "Other title" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].params).toMatchObject({
      q: "*:*", fq: [`{!terms f=id}${first},${second}`], rows: 2, fl: "id,title_en,title_sort",
    });
  });

  it("batches parents and keeps earlier titles if a later batch fails", async () => {
    const docs = Array.from({ length: 101 }, (_, i) => ({
      version_of_s: `http://bartoc.org/en/node/${i + 1}`,
    })) as SolrDocument[];
    request.mockResolvedValueOnce({ data: { response: { docs: [{ id: first, title_en: "Main" }] } } });
    request.mockRejectedValueOnce(new Error("Solr unavailable"));

    expect(await getParentTitles(docs)).toEqual({ [first]: "Main" });
    const params = request.mock.calls.map(([options]) => options.params as { rows: number; fq: string[] });
    expect(params.map(batch => batch.rows)).toEqual([100, 1]);
    expect(params[1].fq).toEqual(["{!terms f=id}http://bartoc.org/en/node/101"]);
  });

  it("returns no titles when parents are absent or Solr fails", async () => {
    const docs = [{ version_of_s: first }] as SolrDocument[];
    expect(await getParentTitles(docs)).toEqual({});
    request.mockRejectedValueOnce(new Error("Solr unavailable"));
    expect(await getParentTitles(docs)).toEqual({});
  });
});
