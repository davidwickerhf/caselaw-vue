import { describe, it, expect } from 'vitest';
import { recognizeKeywords } from '../../lib/parser/recognizers/keyword-recognizer';
import { recognizeArticles } from '../../lib/parser/recognizers/article-recognizer';
import { recognizeStates } from '../../lib/parser/recognizers/state-recognizer';
import { recognizeSources } from '../../lib/parser/recognizers/source-recognizer';
import { recognizeMetadata } from '../../lib/parser/recognizers/metadata-recognizer';
import { recognizeDates } from '../../lib/parser/recognizers/date-recognizer';
import { recognizeEcli } from '../../lib/parser/recognizers/ecli-recognizer';
import { recognizeApplicationNumbers } from '../../lib/parser/recognizers/application-recognizer';

describe('recognizers', () => {
  it('extracts quoted keywords with cleaned casing', () => {
    const input = 'Find "right to life" and "  freedom   of expression " cases';
    const result = recognizeKeywords(input);
    expect(result.suggestions.length).toBe(2);
    expect(result.suggestions[0].token.value).toBe('Right to Life');
    expect(result.suggestions[1].token.value).toBe('Freedom of Expression');
  });

  it('detects article violations and non-violations', () => {
    const violated = recognizeArticles('Article 3 violated in Turkey');
    expect(violated.suggestions[0].token.type).toBe('article_violated');
    expect(violated.suggestions[0].token.value).toBe('3');

    const non = recognizeArticles('Art. 6 non-violated');
    expect(non.suggestions[0].token.type).toBe('article_non_violated');
    expect(non.suggestions[0].token.value).toBe('6');

    const nl = recognizeArticles('artikel 6 niet geschonden');
    expect(nl.suggestions[0].token.type).toBe('article_non_violated');
    expect(nl.suggestions[0].token.value).toBe('6');
  });

  it('detects respondent states', () => {
    const result = recognizeStates('Cases from Germany and Turkey');
    const values = result.suggestions.map((s) => s.token.value);
    expect(values).toContain('Germany');
    expect(values).toContain('Turkey');

    const nl = recognizeStates('Zaken uit Duitsland en Turkije');
    const nlValues = nl.suggestions.map((s) => s.token.value);
    expect(nlValues).toContain('Germany');
    expect(nlValues).toContain('Turkey');
  });

  it('detects data sources', () => {
    const result = recognizeSources('ECHR cases and Rechtspraak decisions');
    const values = result.suggestions.map((s) => s.token.value);
    expect(values).toContain('ECHR');
    expect(values).toContain('RS');

    const nl = recognizeSources('EHRM uitspraken en rechtspraak.nl');
    const nlValues = nl.suggestions.map((s) => s.token.value);
    expect(nlValues).toContain('ECHR');
    expect(nlValues).toContain('RS');
  });

  it('detects document types and importance', () => {
    const result = recognizeMetadata('Grand chamber judgment importance 2');
    const types = result.suggestions.filter((s) => s.token.type === 'document_type').map((s) => s.token.value);
    const importance = result.suggestions.find((s) => s.token.type === 'importance');
    expect(types).toContain('HECJUD');
    expect(importance?.token.value).toBe('2');

    const nl = recognizeMetadata('grote kamer arrest belangrijke zaak');
    const nlTypes = nl.suggestions.filter((s) => s.token.type === 'document_type').map((s) => s.token.value);
    const nlImportance = nl.suggestions.find((s) => s.token.type === 'importance');
    expect(nlTypes).toContain('HECJUD');
    expect(nlImportance?.token.value).toBe('2');
  });

  it('detects a variety of dates', () => {
    const range = recognizeDates('from 12 March 2014 to 5 May 2016');
    const types = range.suggestions.flatMap((s) => (s.tokens ? s.tokens.map((t) => t.type) : [s.token.type]));
    expect(types).toContain('date_start');
    expect(types).toContain('date_end');

    const between = recognizeDates('tussen 2014 en 2016');
    const betweenTypes = between.suggestions.flatMap((s) => (s.tokens ? s.tokens.map((t) => t.type) : [s.token.type]));
    expect(betweenTypes).toContain('date_start');
    expect(betweenTypes).toContain('date_end');

    const year = recognizeDates('cases in 2020');
    expect(year.suggestions.some((s) => s.token.type === 'year' && s.token.value === '2020')).toBe(true);

    const month = recognizeDates('12 March 2018');
    expect(month.suggestions.some((s) => s.token.value === '2018')).toBe(true);

    const monthNl = recognizeDates('12 maart 2018');
    expect(monthNl.suggestions.some((s) => s.token.value === '2018')).toBe(true);
  });

  it('detects ECLI references', () => {
    const result = recognizeEcli('ECLI:CE:ECHR:2010:0101JUD000000000');
    expect(result.suggestions[0].token.type).toBe('ecli');
    expect(result.suggestions[0].token.value).toContain('ECLI:CE:ECHR:2010');
  });

  it('detects application numbers', () => {
    const result = recognizeApplicationNumbers('app no. 12345/67');
    expect(result.suggestions[0].token.type).toBe('application_number');
    expect(result.suggestions[0].token.value).toBe('12345/67');

    const nl = recognizeApplicationNumbers('applicatienummer 76543/21');
    expect(nl.suggestions[0].token.type).toBe('application_number');
    expect(nl.suggestions[0].token.value).toBe('76543/21');
  });
});
