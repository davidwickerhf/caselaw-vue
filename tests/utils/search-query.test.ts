import { describe, it, expect } from 'vitest';
import { createDefaultSearchQuery } from '../../lib/types';
import { searchQueryToTokens, searchQueryToQueryBuilderGroup, queryBuilderGroupToSearchQuery } from '../../lib/utils/search-query';

describe('search-query utils', () => {
  it('creates tokens for key fields', () => {
    const query = createDefaultSearchQuery();
    query.respondentState = ['Germany'];
    query.articleNonViolated = ['3'];
    query.applicationNumbers = ['12345/67'];
    query.eclis = ['ECLI:CE:ECHR:2010:0101JUD000000000'];
    query.keywords = ['Right to Life'];

    const tokens = searchQueryToTokens(query);
    const types = tokens.map((t) => t.type);
    expect(types).toContain('respondent_state');
    expect(types).toContain('article_non_violated');
    expect(types).toContain('application_number');
    expect(types).toContain('ecli');
    expect(types).toContain('keyword');
  });

  it('maps search query to query builder group', () => {
    const query = createDefaultSearchQuery();
    query.respondentState = ['Turkey'];
    query.articleViolated = ['2'];
    query.dateStart = '2020-01-01';
    query.dateEnd = '2020-12-31';

    const group = searchQueryToQueryBuilderGroup(query);
    const fields = group.rules.map((r) => r.field);
    expect(fields).toContain('respondent_state');
    expect(fields).toContain('article_violated');
    expect(fields).toContain('year');
  });

  it('converts query builder group back into search query', () => {
    const group = {
      id: 'g',
      operator: 'AND' as const,
      rules: [
        { id: '1', field: 'respondent_state', operator: 'equals', value: 'Germany', sourceScope: 'ECHR' as const },
        { id: '2', field: 'year', operator: 'equals', value: '2020', sourceScope: 'ANY' as const },
        { id: '3', field: 'application_number', operator: 'equals', value: '12345/67', sourceScope: 'ECHR' as const },
      ],
      groups: []
    };

    const result = queryBuilderGroupToSearchQuery(group);
    expect(result.query?.scoped.echr.respondentState).toContain('Germany');
    expect(result.query?.scoped.echr.applicationNumbers).toContain('12345/67');
    expect(result.query?.dateStart).toBe('2020-01-01');
  });

  it('handles judgment and decision dates', () => {
    const group = {
      id: 'g',
      operator: 'AND' as const,
      rules: [
        { id: '1', field: 'date_judgment_start', operator: 'equals', value: '2020-05-01', sourceScope: 'ECHR' as const },
        { id: '2', field: 'date_decision_end', operator: 'before', value: '2021-06-01', sourceScope: 'ECHR' as const },
        { id: '3', field: 'language', operator: 'equals', value: 'ENG', sourceScope: 'ECHR' as const },
        { id: '4', field: 'selectedLaws', operator: 'equals', value: 'BWBX1234|56', sourceScope: 'RS' as const }
      ],
      groups: []
    };

    const result = queryBuilderGroupToSearchQuery(group);
    expect(result.query?.scoped.echr.dateJudgmentStart).toBe('2020-05-01');
    expect(result.query?.scoped.echr.dateJudgmentEnd).toBe('2020-05-01');
    expect(result.query?.scoped.echr.dateDecisionEnd).toBe('2021-06-01');
    expect(result.query?.scoped.echr.language).toContain('ENG');
    expect(result.query?.scoped.rs.selectedLaws).toContain('BWBX1234|56');
  });
});
