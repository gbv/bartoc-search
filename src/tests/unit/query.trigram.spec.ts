// tests/unit/query.trigram.spec.ts
import { buildLuceneWithTrigrams } from "../../server/utils/helpers";

it("adds trigram fallback for simple multi-word query", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: "clasification system",
    baseField: "allfields",
    baseLucene: '(allfields:("clasification" OR "system"))'
  });
  expect(out.q).toMatch(/_query_:"\{!field f=title_trigram\}clasification system"\^0\.6/);
  expect(out.q).toMatch(/_query_:"\{!field f=allfields_trigram\}clasification system"\^0\.25/);
});

it("skips trigram for advanced query", () => {
  const out = buildLuceneWithTrigrams({
    userQuery: 'title:"film classification"',
    baseField: "allfields",
    baseLucene: '(allfields:("film" OR "classification"))'
  });
  expect(out.q).not.toMatch(/trigram/);
});
