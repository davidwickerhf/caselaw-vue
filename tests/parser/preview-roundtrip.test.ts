import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageToQueryBuilderGroup } from '../../lib/parser/nl-query-parser';
import { buildQuerySummarySegments } from '../../lib/utils/query-summary';
import { parseSearchInput } from '../../lib/parser/search-parser';

function extractDegrees(text: string) {
  const result = parseSearchInput(text);
  let degreesSource: number | undefined;
  let degreesTarget: number | undefined;
  let isSubgraph = false;
  for (const token of result.tokens) {
    if (token.type === 'degree_source') degreesSource = Number(token.value);
    if (token.type === 'degree_target') degreesTarget = Number(token.value);
    if (token.type === 'degree_depth') {
      degreesSource = Number(token.value);
      degreesTarget = Number(token.value);
    }
    if (token.type === 'subgraph') isSubgraph = true;
  }
  return { degreesSource, degreesTarget, isSubgraph };
}

function toPreview(text: string): string {
  const group = parseNaturalLanguageToQueryBuilderGroup(text);
  const meta = extractDegrees(text);
  return buildQuerySummarySegments(group, meta)
    .map((seg) => seg.text)
    .join('');
}

describe('query preview round-trip', () => {
  const cases = [
    'Cases in Germany in 2010 with Article 6 violated',
    'ECHR "fair trial" 2018',
    'Rechtspraak "tax law" between 2014 and 2016',
    'Rechtspraak Raad van State 2016',
    'ECLI:NL:HR:2019:1234',
    'ECHR application number 23459/03 Turkey',
    'ECHR Article 8 non-violated "privacy" 2021',
    'Rechtspraak Bestuursrecht 2018',
    'ECHR respondent state Italy',
    'ECHR "freedom of expression" OR "fair trial" 2019',
    'ECHR "right to life" AND Turkey 2014',
    'Rechtspraak 2015-2017 "asylum seeker"',
    'ECHR between 2012 and 2014 Article 3',
    'Any: Data Source is RS AND Rechtspraak: Full Text contains "Tax Law" AND Rechtspraak: Year after 2014 AND Rechtspraak: Year before 2016',
    'ECHR: Respondent State is Germany AND Any: Year equals 2011',
    'Rechtspraak: Court Instance is Raad van State AND Rechtspraak: Year equals 2016',
    'Any: ECLI contains ECLI:NL:RBAMS',
    'ECHR: Article Violated is 5 AND Any: Year after 2018',
    'Rechtspraak "intellectual property" 2020',
    'ECHR "inhuman treatment" Turkey between 2014 and 2016',
    '(ECHR: Article Violated is 5 AND Any: Year after 2018) OR (Rechtspraak: Legal Domain is Bestuursrecht AND Any: Year after 2018)',
    'ECHR language ENG and judgment date on 2020-05-01',
    'Rechtspraak selected law BWBX1234|56 and domain Bestuursrecht',
    'Any: Date Start equals 2020-02-01 AND Any: Date End equals 2020-03-15',
    'ECHR: Judgment Date Start equals 2020-05-01',
    'ECHR: Decision Date End before 2021-06-01',
    'ECHR Article 2 violated Italy depth 2',
    'degree source 1 degree target 3 subgraph'
  ];

  it('preserves preview when re-parsed', () => {
    for (const text of cases) {
      const previewA = toPreview(text);
      expect(previewA.length).toBeGreaterThan(0);
      const previewB = toPreview(previewA);
      expect(previewB).toBe(previewA);
    }
  });
});
