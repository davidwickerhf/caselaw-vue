import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageToQueryBuilderGroup } from '../../lib/parser/nl-query-parser';

function findRule(group: ReturnType<typeof parseNaturalLanguageToQueryBuilderGroup>, field: string, value?: string) {
  const rules = [...group.rules, ...group.groups.flatMap((g) => g.rules)];
  return rules.find((r) => r.field === field && (value ? r.value === value : true));
}

describe('parseNaturalLanguageToQueryBuilderGroup', () => {
  it('scopes ECHR rules and detects articles + states', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('ECHR Article 3 non-violated and respondent state Armenia');
    const article = findRule(group, 'article_non_violated', '3');
    const state = findRule(group, 'respondent_state', 'Armenia');
    expect(article?.sourceScope).toBe('ECHR');
    expect(state?.sourceScope).toBe('ECHR');
  });

  it('creates OR groups for connectors', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('2019 or 2020');
    expect(group.operator).toBe('OR');
    const has2019 = findRule(group, 'year', '2019');
    const has2020 = findRule(group, 'year', '2020');
    expect(has2019).toBeTruthy();
    expect(has2020).toBeTruthy();
  });

  it('creates OR groups for Dutch connectors', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('2019 of 2020');
    expect(group.operator).toBe('OR');
    const has2019 = findRule(group, 'year', '2019');
    const has2020 = findRule(group, 'year', '2020');
    expect(has2019).toBeTruthy();
    expect(has2020).toBeTruthy();
  });

  it('detects parentheses into a group', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('(Article 2 violated or Article 3 violated) and Turkey');
    expect(group.groups.length).toBeGreaterThan(0);
    const state = findRule(group, 'respondent_state', 'Turkey');
    expect(state).toBeTruthy();
  });

  it('handles negation into not_equals', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('not Turkey and Article 3');
    const state = findRule(group, 'respondent_state', 'Turkey');
    expect(state?.operator).toBe('not_equals');
  });

  it('handles Dutch negation into not_equals', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('niet Duitsland en artikel 3');
    const state = findRule(group, 'respondent_state', 'Germany');
    expect(state?.operator).toBe('not_equals');
  });

  it('detects Rechtspraak scoped domains', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('Rechtspraak strafrecht 2020');
    const domain = findRule(group, 'domain', 'Strafrecht');
    expect(domain?.sourceScope).toBe('RS');
  });

  it('detects Dutch date ranges', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('tussen 2014 en 2016 Turkije');
    const after = group.rules.find((r) => r.field === 'year' && r.operator === 'after');
    const before = group.rules.find((r) => r.field === 'year' && r.operator === 'before');
    expect(after?.value).toBe('2014');
    expect(before?.value).toBe('2016');
  });

  it('detects explicit ISO date start and end', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('date start 2020-02-01 and date end 2020-03-15');
    const startRule = findRule(group, 'dateStart', '2020-02-01');
    const endRule = findRule(group, 'dateEnd', '2020-03-15');
    expect(startRule?.operator).toBe('equals');
    expect(endRule?.operator).toBe('equals');
  });

  it('detects judgment date equals', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('judgment date on 2020-05-01');
    const rule = findRule(group, 'date_judgment_start', '2020-05-01');
    expect(rule?.operator).toBe('equals');
    expect(rule?.sourceScope).toBe('ECHR');
  });

  it('detects language ISO-3 codes', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('language ENG');
    const rule = findRule(group, 'language', 'ENG');
    expect(rule?.sourceScope).toBe('ECHR');
  });

  it('detects selected laws', () => {
    const group = parseNaturalLanguageToQueryBuilderGroup('selected law BWBX1234|56');
    const rule = findRule(group, 'selectedLaws', 'BWBX1234|56');
    expect(rule?.sourceScope).toBe('RS');
  });
});
