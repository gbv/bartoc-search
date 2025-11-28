import { DdcStore } from "./store";
import { DdcExpansion, DdcConcept } from "./types";
import { expandDdcConcept } from "./enrich";


export class DdcEnricher {
  constructor(private store: DdcStore) {}

  static async create() {
    const s = await DdcStore.fromjson();
    // config.log?.(`✅ Loaded DDC concepts from ${DDC_FILE}`);
    return new DdcEnricher(s);
  }

  expandUris(uris: string[]): DdcExpansion {
    const acc: DdcExpansion = {
      roots: [], ancestors: [], exact: [],
      labels: { rank1: [], rank2: [], rank3: [] },
    };

    for (const uri of uris) {
      const c: DdcConcept | undefined = this.store.get(uri);
      if (!c) continue;
      const e = expandDdcConcept(c);
      acc.roots.push(...e.roots);
      acc.ancestors.push(...e.ancestors);
      acc.exact.push(...e.exact);
      acc.labels.rank1.push(...e.labels.rank1);
      acc.labels.rank2.push(...e.labels.rank2);
      acc.labels.rank3.push(...e.labels.rank3);
    }

    const uniq = <T,>(a: T[]) => Array.from(new Set(a));
    acc.roots = uniq(acc.roots);
    acc.ancestors = uniq(acc.ancestors);
    acc.exact = uniq(acc.exact);
    acc.labels.rank1 = uniq(acc.labels.rank1);
    acc.labels.rank2 = uniq(acc.labels.rank2);
    acc.labels.rank3 = uniq(acc.labels.rank3);
    return acc;
  }
}
