import { describe, it, expect } from 'vitest';
import { ALL_DATA_SOURCES, DataSource, createDefaultSearchQuery, type QueryBuilderGroup } from '../../lib/types';
import { buildCombinedPayload, transformApiNode } from '../../lib/api/client';
import { searchQueryToQueryBuilderGroup, queryBuilderGroupToSearchQuery, paramsToSearchQuery } from '../../lib/utils/search-query';
import { datasetFromEcli, parseDataSource, sourceLabel } from '../../lib/utils/sources';
import { languageLabel } from '../../lib/utils/constants';
import { QUERY_BUILDER_FIELDS_BY_SCOPE } from '../../lib/utils/query-builder-config';
import { paramsToQueryBuilderState, queryBuilderGroupToParams } from '../../lib/utils/query-builder-url';
import { mapServerFacets } from '../../lib/utils/search-engine';
import { parseNaturalLanguageToQueryBuilderGroup } from '../../lib/parser/nl-query-parser';

function group(rules: QueryBuilderGroup['rules']): QueryBuilderGroup {
  return { id: 'root', operator: 'AND', rules, groups: [] };
}

describe('CJEU support', () => {
  it('detects corpora from ECLIs and names', () => {
    expect(datasetFromEcli('ECLI:EU:C:2014:317')).toBe('CJEU');
    expect(datasetFromEcli('ECLI:EU:T:2021:5')).toBe('CJEU');
    expect(datasetFromEcli('ECLI:CE:ECHR:2020:0101JUD000000000')).toBe('ECHR');
    expect(datasetFromEcli('ECLI:NL:HR:2020:1')).toBe('RS');
    expect(parseDataSource('curia')).toBe(DataSource.CJEU);
    expect(sourceLabel('CJEU')).toBe('CJEU');
    expect(sourceLabel('HUDOC')).toBe('ECHR');
  });

  it('searches all three corpora by default', () => {
    expect(createDefaultSearchQuery().sources).toEqual(ALL_DATA_SOURCES);
  });

  it('turns a CJEU combined node into a citation', () => {
    const citation = transformApiNode({
      id: 'ECLI:EU:C:2026:982',
      data: {
        dataset: 'CJEU', title: 'Case C-476/25', case_number: 'C-476/25', celex: '62025CJ0476',
        document_type: 'judgment', court: 'CJEU', formation: 'Seventh Chamber (3 judges)',
        procedure_type: 'Reference for a preliminary ruling', date_decision: '2026-11-12',
        importance: 3, languages: ['en', 'fr'], cites_count: 4, cited_by_count: 2, isResult: 'True',
      },
    });
    expect(citation.source).toBe('CJEU');
    expect(citation.year).toBe(2026);
    expect(citation.case_number).toBe('C-476/25');
    expect(citation.nCiting).toBe(4);
    expect(citation.nCited).toBe(2);
    expect(citation.url_publication).toContain('62025CJ0476');
  });

  it('sends CJEU rules, and maps document type aliases to document_type', () => {
    const payload = buildCombinedPayload(createDefaultSearchQuery(), group([
      { id: '1', field: 'subject', operator: 'equals', value: 'Data protection', sourceScope: 'CJEU' },
      { id: '2', field: 'cjeu_document_type', operator: 'equals', value: 'Judgment', sourceScope: 'CJEU' },
      { id: '3', field: 'court', operator: 'equals', value: 'egc', sourceScope: 'CJEU' },
      { id: '4', field: 'echr_document_type', operator: 'equals', value: 'JUD', sourceScope: 'ECHR' },
      { id: '5', field: 'source', operator: 'equals', value: 'CJEU', sourceScope: 'ANY' },
    ]));
    expect(payload.queryBuilder.rules).toEqual([
      { field: 'subject', operator: 'equals', value: 'Data protection', sourceScope: 'CJEU' },
      { field: 'document_type', operator: 'equals', value: 'judgment', sourceScope: 'CJEU' },
      { field: 'court', operator: 'equals', value: 'EGC', sourceScope: 'CJEU' },
      { field: 'document_type', operator: 'equals', value: 'JUD', sourceScope: 'ECHR' },
      { field: 'source', operator: 'equals', value: 'CJEU', sourceScope: 'ANY' },
    ]);
  });

  it('accepts ISO 639-1 language codes', () => {
    const payload = buildCombinedPayload(createDefaultSearchQuery(), group([
      { id: '1', field: 'language', operator: 'equals', value: 'EN', sourceScope: 'ECHR' },
    ]));
    expect(payload.queryBuilder.rules[0].value).toBe('en');
    expect(languageLabel('en')).toBe('English');
    expect(languageLabel('FRE')).toBe('French');
  });

  it('excludes unselected corpora when two of three are picked', () => {
    const query = createDefaultSearchQuery();
    query.sources = [DataSource.ECHR, DataSource.CJEU];
    const built = searchQueryToQueryBuilderGroup(query);
    const sourceRules = built.rules.filter((r) => r.field === 'source');
    expect(sourceRules.map((r) => [r.operator, r.value])).toEqual([['not_equals', 'RS']]);

    const parsed = queryBuilderGroupToSearchQuery(built);
    expect(parsed.query?.sources).toEqual([DataSource.ECHR, DataSource.CJEU]);
  });

  it('keeps CJEU rules out of the flat query without failing', () => {
    const parsed = queryBuilderGroupToSearchQuery(group([
      { id: '1', field: 'keywords', operator: 'contains', value: 'privacy', sourceScope: 'ANY' },
      { id: '2', field: 'subject', operator: 'equals', value: 'Data protection', sourceScope: 'CJEU' },
      { id: '3', field: 'importance', operator: 'equals', value: '1', sourceScope: 'CJEU' },
    ]));
    expect(parsed.error).toBeUndefined();
    expect(parsed.query?.importance).toEqual([]);
  });

  it('round-trips CJEU filters through URL params', () => {
    const params = new URLSearchParams('sources=CJEU&cjeuCourt=EGC&cjeuImportance=1,9');
    const parsed = paramsToSearchQuery(params);
    expect(parsed.query?.sources).toEqual([DataSource.CJEU]);
    expect(parsed.query?.cjeuCourt).toEqual(['EGC']);
    expect(parsed.query?.cjeuImportance).toEqual([1]);

    const query = createDefaultSearchQuery();
    query.cjeuCourt = ['EGC'];
    const rules = searchQueryToQueryBuilderGroup(query).rules;
    expect(rules).toContainEqual(expect.objectContaining({ field: 'court', value: 'EGC', sourceScope: 'CJEU' }));
  });

  it('maps CJEU server facets and drops stray court values', () => {
    const facets = mapServerFacets({
      cjeu_document_type: [{ value: 'judgment', count: 7 }],
      cjeu_court: [{ value: 'CJEU', count: 5 }, { value: 'RS:Rechtbank Breda', count: 1 }],
    }, { rsTotal: 0, echrTotal: 3, cjeuTotal: 7 });
    expect(facets.sources).toEqual([{ value: 'HUDOC', count: 3 }, { value: 'CJEU', count: 7 }]);
    expect(facets.cjeuCourts).toEqual([{ value: 'CJEU', count: 5 }]);
    expect(facets.cjeuDocumentTypes).toEqual([{ value: 'judgment', count: 7 }]);
  });

  it('recognises CJEU in natural language without mistaking it for ECHR', () => {
    const built = parseNaturalLanguageToQueryBuilderGroup('data protection cases from the european court of justice');
    const sources = [...built.rules, ...built.groups.flatMap((g) => g.rules)]
      .filter((r) => r.field === 'source')
      .map((r) => r.value);
    expect(sources).toContain('CJEU');
    expect(sources).not.toContain('ECHR');
  });

  it('keeps the search words when a court is the only thing recognised', () => {
    for (const [input, source] of [['airline court of justice', 'CJEU'], ['airline echr', 'ECHR']]) {
      const built = parseNaturalLanguageToQueryBuilderGroup(input);
      expect(built.rules.map((r) => [r.field, r.value])).toEqual([['source', source], ['text', 'airline']]);
    }
    const phrase = parseNaturalLanguageToQueryBuilderGroup('data protection cases from the european court of justice');
    expect(phrase.rules.find((r) => r.field === 'text')?.value).toBe('data protection');
  });

  it('keeps every query builder field through a shared URL', () => {
    for (const [sourceScope, fields] of Object.entries(QUERY_BUILDER_FIELDS_BY_SCOPE)) {
      for (const { value: field } of fields) {
        const rule = { id: 'r', field, operator: 'equals', value: '1', sourceScope: sourceScope as 'CJEU' };
        const { state } = paramsToQueryBuilderState(queryBuilderGroupToParams(group([rule])));
        expect(state?.group.rules.map((r) => [r.field, r.value, r.sourceScope])).toEqual([[field, '1', sourceScope]]);
      }
    }
  });

  it('does not search for connectors and negations next to a source', () => {
    for (const input of ['not echr', 'niet echr', 'echr or rechtspraak']) {
      const built = parseNaturalLanguageToQueryBuilderGroup(input);
      expect(built.rules.filter((r) => r.field === 'text')).toEqual([]);
    }
  });

  it('applies leftover words to each of several alternative sources', () => {
    const built = parseNaturalLanguageToQueryBuilderGroup('airline cjeu or echr');
    expect(built.operator).toBe('AND');
    expect(built.rules.map((r) => [r.field, r.operator, r.value]))
      .toEqual([['source', 'not_equals', 'RS'], ['text', 'contains', 'airline']]);
  });
});
