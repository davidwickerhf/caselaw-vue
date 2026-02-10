import { describe, it, expect } from 'vitest';
import { queryBuilderGroupToParams, paramsToQueryBuilderState } from '../../lib/utils/query-builder-url';

describe('query-builder URL utils', () => {
  it('round-trips group to params and back', () => {
    const group = {
      id: 'root',
      operator: 'AND' as const,
      rules: [
        { id: '1', field: 'year', operator: 'equals', value: '2020', sourceScope: 'ANY' as const },
        { id: '2', field: 'respondent_state', operator: 'equals', value: 'Germany', sourceScope: 'ECHR' as const },
      ],
      groups: [
        {
          id: 'g1',
          operator: 'OR' as const,
          rules: [{ id: '3', field: 'domain', operator: 'equals', value: 'Strafrecht', sourceScope: 'RS' as const }],
          groups: []
        }
      ]
    };

    const params = queryBuilderGroupToParams(group, { pageSize: 50, cursor: 'abc', searchString: 'test', sortBy: 'citations', sortDirection: 'asc', page: 3 });
    const parsed = paramsToQueryBuilderState(params);
    expect(parsed.state).toBeTruthy();
    expect(parsed.state?.group.rules.length).toBeGreaterThan(0);
    expect(parsed.state?.group.groups.length).toBe(1);
    expect(parsed.state?.pageSize).toBe(50);
    expect(parsed.state?.cursor).toBe('abc');
    expect(parsed.state?.searchString).toBe('test');
    expect(parsed.state?.sortBy).toBe('citations');
    expect(parsed.state?.sortDirection).toBe('asc');
    expect(parsed.state?.page).toBe(3);
  });

  // ── Security tests ──

  it('rejects oversized qb JSON payload', () => {
    const params = new URLSearchParams();
    // Create a payload larger than MAX_QB_JSON_LENGTH (50 KB)
    params.set('qb', '{"op":"AND","rules":[],"groups":[]}' + 'x'.repeat(60_000));
    const result = paramsToQueryBuilderState(params);
    expect(result.error).toBeTruthy();
  });

  it('strips HTML and script from rule values', () => {
    const group = {
      id: 'root',
      operator: 'AND' as const,
      rules: [
        { id: '1', field: 'text', operator: 'contains', value: '<script>alert(1)</script>hello', sourceScope: 'ANY' as const },
      ],
      groups: []
    };

    const params = queryBuilderGroupToParams(group);
    const parsed = paramsToQueryBuilderState(params);
    const textRule = parsed.state?.group.rules.find(r => r.field === 'text');
    expect(textRule?.value).not.toContain('<script>');
    expect(textRule?.value).toContain('hello');
  });

  it('rejects unknown field names in rules', () => {
    const params = new URLSearchParams();
    params.set('qb', JSON.stringify({
      op: 'AND',
      rules: [{ f: '__proto__', o: 'equals', v: 'test', s: 'ANY' }],
      groups: []
    }));
    const result = paramsToQueryBuilderState(params);
    // The unknown field rule should be silently dropped
    expect(result.state).toBeTruthy();
    // Only the empty default rule should remain
    expect(result.state?.group.rules.every(r => r.field !== '__proto__')).toBe(true);
  });

  it('rejects unknown operators in rules', () => {
    const params = new URLSearchParams();
    params.set('qb', JSON.stringify({
      op: 'AND',
      rules: [{ f: 'text', o: 'DROP TABLE', v: 'test', s: 'ANY' }],
      groups: []
    }));
    const result = paramsToQueryBuilderState(params);
    expect(result.state).toBeTruthy();
    expect(result.state?.group.rules.every(r => r.operator !== 'DROP TABLE')).toBe(true);
  });

  it('caps pageSize to MAX_PAGE_SIZE', () => {
    const params = new URLSearchParams();
    params.set('qb', JSON.stringify({ op: 'AND', rules: [{ f: 'text', o: 'contains', v: 'test', s: 'ANY' }], groups: [] }));
    params.set('pageSize', '99999');
    const result = paramsToQueryBuilderState(params);
    expect(result.state?.pageSize).toBeLessThanOrEqual(200);
  });

  it('rejects invalid sortBy values', () => {
    const params = new URLSearchParams();
    params.set('qb', JSON.stringify({ op: 'AND', rules: [{ f: 'text', o: 'contains', v: 'test', s: 'ANY' }], groups: [] }));
    params.set('sortBy', 'DROP TABLE');
    const result = paramsToQueryBuilderState(params);
    expect(result.state?.sortBy).toBeUndefined();
  });

  it('caps the number of rules and groups', () => {
    const manyRules = Array.from({ length: 500 }, (_, i) => ({
      f: 'text', o: 'contains', v: `term${i}`, s: 'ANY'
    }));
    const manyGroups = Array.from({ length: 50 }, (_, i) => ({
      op: 'OR',
      rules: [{ f: 'text', o: 'contains', v: `group${i}`, s: 'ANY' }]
    }));
    const params = new URLSearchParams();
    params.set('qb', JSON.stringify({ op: 'AND', rules: manyRules, groups: manyGroups }));
    const result = paramsToQueryBuilderState(params);
    expect(result.state).toBeTruthy();
    expect(result.state!.group.rules.length).toBeLessThanOrEqual(200);
    expect(result.state!.group.groups.length).toBeLessThanOrEqual(20);
  });
});
