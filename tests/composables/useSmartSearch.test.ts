import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSmartSearch } from '../../composables/useSmartSearch';

describe('useSmartSearch', () => {
  const smart = useSmartSearch();

  beforeEach(() => {
    vi.useFakeTimers();
    smart.clearAll();
  });

  it('builds query builder rules from natural language text', () => {
    smart.setFromText('Article 3 violated Turkey');
    const rules = smart.queryBuilderGroup.value.rules;
    const hasArticle = rules.some((r) => r.field === 'article_violated' && r.value === '3');
    const hasState = rules.some((r) => r.field === 'respondent_state' && r.value === 'Turkey');
    expect(hasArticle).toBe(true);
    expect(hasState).toBe(true);
  });

  it('accepts suggestions softly without changing raw text', () => {
    smart.setFromText('Germany 2020');
    const originalText = smart.rawText.value;
    const suggestion = smart.suggestions.value.find((s) => s.token.type === 'respondent_state');
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      smart.acceptSuggestionSoft(suggestion.id);
    }
    const rules = smart.queryBuilderGroup.value.rules;
    const hasState = rules.some((r) => r.field === 'respondent_state' && r.value === 'Germany');
    expect(hasState).toBe(true);
    expect(smart.rawText.value).toBe(originalText);
  });

  it('accepts all suggestions softly on submit path', () => {
    smart.setFromText('Turkey 2020');
    smart.acceptAllSuggestionsSoft();
    const rules = smart.queryBuilderGroup.value.rules;
    const hasState = rules.some((r) => r.field === 'respondent_state' && r.value === 'Turkey');
    const hasYear = rules.some((r) => r.field === 'year' && r.value === '2020');
    expect(hasState).toBe(true);
    expect(hasYear).toBe(true);
  });

  it('parses Dutch natural language into rules', () => {
    smart.setFromText('EHRM artikel 2 geschonden en Turkije');
    const rules = smart.queryBuilderGroup.value.rules;
    const hasArticle = rules.some((r) => r.field === 'article_violated' && r.value === '2');
    const hasState = rules.some((r) => r.field === 'respondent_state' && r.value === 'Turkey');
    expect(hasArticle).toBe(true);
    expect(hasState).toBe(true);
  });

});
