// tests/unit/query.trigram.spec.ts
import { buildLuceneWithTrigrams } from "../../server/utils/helpers";

it("adds trigram fallback for simple multi-word query", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: "clasification system",
    baseField: "allfields",
    baseLucene: '(allfields:("clasification" OR "system"))'
  });
  expect(out.q).toMatch(/_query_:"\{!field f=notation_ss\}clasification system"\^12/);
  expect(out.q).toMatch(/_query_:"\{!field f=alt_labels_ss\}clasification system"\^12/);
  expect(out.q).toMatch(/_query_:"\{!field f=bartoc_id_s\}clasification system"\^12/);
  expect(out.q).toMatch(/_query_:"\{!edismax qf=title_trigram mm=90%\}cla las asi sif ifi fic ica cat ati tio ion sys yst ste tem"\^0\.6/);
  expect(out.q).toMatch(/_query_:"\{!edismax qf=allfields_trigram mm=90%\}cla las asi sif ifi fic ica cat ati tio ion sys yst ste tem"\^0\.25/);
});

it("passes generated trigrams to the fuzzy fallback", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: "sasdfdd",
    baseField: "allfields",
    baseLucene: '(allfields:("sasdfdd"^3))'
  });
  expect(out.q).toMatch(/_query_:"\{!edismax qf=title_trigram mm=50%\}sas asd sdf dfd fdd"\^0\.6/);
});

it("boosts exact abbreviation fields for global search", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: "AAT",
    baseField: "allfields",
    baseLucene: '(allfields:("AAT"^3))'
  });
  expect(out.q).toMatch(/_query_:"\{!field f=notation_ss\}AAT"\^12/);
  expect(out.q).toMatch(/_query_:"\{!field f=alt_labels_ss\}AAT"\^12/);
  expect(out.q).toMatch(/_query_:"\{!field f=bartoc_id_s\}AAT"\^12/);
});

it("boosts exact BARTOC id matches for global search", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: "17994",
    baseField: "allfields",
    baseLucene: '(allfields:("17994"^3))'
  });
  expect(out.q).toMatch(/_query_:"\{!field f=bartoc_id_s\}17994"\^12/);
});

it("does not add abbreviation boosts to title-only search", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: "AAT",
    baseField: "title_search",
    baseLucene: '(title_search:("AAT"^3))'
  });
  expect(out.q).not.toMatch(/notation_ss/);
  expect(out.q).not.toMatch(/alt_labels_ss/);
  expect(out.q).not.toMatch(/bartoc_id_s/);
  expect(out.q).not.toMatch(/trigram/);
});

it("does not add trigram fallback to field-specific search", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: "Clasification",
    baseField: "title_search",
    baseLucene: '(title_search:("Clasification"^3))'
  });
  expect(out.q).toBe('(title_search:("Clasification"^3))');
});

it("skips trigram for advanced query", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: 'title:"film classification"',
    baseField: "allfields",
    baseLucene: '(allfields:("film" OR "classification"))'
  });
  expect(out.q).not.toMatch(/trigram/);
});
