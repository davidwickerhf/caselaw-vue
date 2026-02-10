import { describe, it, expect } from 'vitest';
import { createDefaultSearchQuery } from '../../lib/types';
import { searchQueryToTokens, searchQueryToQueryBuilderGroup, queryBuilderGroupToSearchQuery, paramsToSearchQuery } from '../../lib/utils/search-query';

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

describe('paramsToSearchQuery – security', () => {
  it('strips script tags from text query', () => {
    const params = new URLSearchParams();
    params.set('q', '<script>alert("xss")</script>fair trial');
    const result = paramsToSearchQuery(params);
    expect(result.query).toBeTruthy();
    expect(result.query!.text).not.toContain('<script>');
    expect(result.query!.text).toContain('fair trial');
  });

  it('strips HTML from filter values', () => {
    const params = new URLSearchParams();
    params.set('keywords', '<img onerror=alert(1) src=x>right to life');
    const result = paramsToSearchQuery(params);
    expect(result.query!.keywords[0]).not.toContain('<img');
    expect(result.query!.keywords[0]).not.toContain('onerror');
  });

  it('strips javascript: URIs from text', () => {
    const params = new URLSearchParams();
    params.set('q', 'javascript:alert(1) fair trial');
    const result = paramsToSearchQuery(params);
    expect(result.query!.text).not.toContain('javascript:');
  });

  it('rejects invalid ECLIs', () => {
    const params = new URLSearchParams();
    params.set('eclis', 'NOT_AN_ECLI,ECLI:CE:ECHR:2020:TEST');
    const result = paramsToSearchQuery(params);
    // The first (invalid) ECLI should be dropped
    expect(result.query!.eclis).not.toContain('NOT_AN_ECLI');
    // The second (valid) one should be kept
    expect(result.query!.eclis).toContain('ECLI:CE:ECHR:2020:TEST');
  });

  it('caps arrays to MAX_ARRAY_ITEMS', () => {
    const params = new URLSearchParams();
    const longList = Array.from({ length: 200 }, (_, i) => `keyword${i}`).join(',');
    params.set('keywords', longList);
    const result = paramsToSearchQuery(params);
    expect(result.query!.keywords.length).toBeLessThanOrEqual(100);
  });

  it('caps pageSize to MAX_PAGE_SIZE', () => {
    const params = new URLSearchParams();
    params.set('q', 'test');
    params.set('pageSize', '50000');
    const result = paramsToSearchQuery(params);
    expect(result.query!.pageSize).toBeLessThanOrEqual(200);
  });

  it('bounds importance to 1-4', () => {
    const params = new URLSearchParams();
    params.set('importance', '1,999');
    const result = paramsToSearchQuery(params);
    // Should fail because 999 is out of range 1-4
    expect(result.error).toBeTruthy();
  });

  it('sanitises cursor tokens', () => {
    const params = new URLSearchParams();
    params.set('q', 'test');
    params.set('cursor', '<script>alert(1)</script>abc123');
    const result = paramsToSearchQuery(params);
    expect(result.query!.cursor).not.toContain('<script>');
    expect(result.query!.cursor).toContain('abc123');
  });
});
