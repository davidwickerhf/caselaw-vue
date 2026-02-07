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

    const params = queryBuilderGroupToParams(group, { pageSize: 100, cursor: 'abc', searchString: 'test', sortBy: 'date', sortDirection: 'asc', page: 3 });
    const parsed = paramsToQueryBuilderState(params);
    expect(parsed.state).toBeTruthy();
    expect(parsed.state?.group.rules.length).toBeGreaterThan(0);
    expect(parsed.state?.group.groups.length).toBe(1);
    expect(parsed.state?.pageSize).toBeUndefined();
    expect(parsed.state?.cursor).toBe('abc');
    expect(parsed.state?.searchString).toBe('test');
    expect(parsed.state?.sortBy).toBe('date');
    expect(parsed.state?.sortDirection).toBe('asc');
    expect(parsed.state?.page).toBe(3);
  });
});
