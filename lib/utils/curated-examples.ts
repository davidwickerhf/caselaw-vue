/**
 * Single source of truth for curated search examples.
 *
 * Used by:
 *   • pages/examples.vue — displayed in the examples gallery
 *   • tests/integration/examples-api.test.ts — integration-tested against the API
 */

import type { QueryBuilderGroup } from '~/lib/types'
import { defaultScopeForField } from '~/lib/utils/query-builder-config'
import { parseNaturalLanguageToQueryBuilderGroup } from '~/lib/parser/nl-query-parser'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExampleItem = {
  id: string
  title: string
  description: string
  searchText?: string
  group: QueryBuilderGroup
  scope: 'ECHR' | 'RS' | 'MIXED'
  tags: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function makeRule(
  field: string,
  value: string,
  operator: string = 'contains',
  scope?: QueryBuilderGroup['rules'][number]['sourceScope'],
) {
  return {
    id: genId(),
    field,
    operator,
    value,
    sourceScope: scope ?? defaultScopeForField(field),
  }
}

export function makeGroup(
  operator: 'AND' | 'OR' | 'NOT',
  rules: ReturnType<typeof makeRule>[],
  groups: QueryBuilderGroup[] = [],
): QueryBuilderGroup {
  return {
    id: genId(),
    operator,
    rules,
    groups,
  }
}

export function buildTextExample(
  text: string,
  title: string,
  description: string,
  scope: ExampleItem['scope'],
  tags: string[],
): ExampleItem {
  return {
    id: genId(),
    title,
    description,
    searchText: text,
    group: parseNaturalLanguageToQueryBuilderGroup(text),
    scope,
    tags,
  }
}

// ─── Curated text examples (25) ─────────────────────────────────────────────

export const TEXT_EXAMPLES: ExampleItem[] = [
  buildTextExample(
    'Article 3 violated Turkey between 2014 and 2016',
    'Article + date range',
    'Use plain language with articles, countries, and date ranges.',
    'ECHR',
    ['article', 'date range', 'respondent state'],
  ),
  buildTextExample(
    'ECHR respondent state Armenia importance 1',
    'Source + importance',
    'Scope to ECHR and specify importance (1-4) in the same sentence.',
    'ECHR',
    ['source scope', 'importance'],
  ),
  buildTextExample(
    'Rechtspraak "intellectual property" 2020',
    'Rechtspraak topical search',
    'Mention Rechtspraak and add a quoted topic plus a year.',
    'RS',
    ['keyword', 'year'],
  ),
  buildTextExample(
    'ECLI:NL:HR:2019:1234',
    'Direct ECLI lookup',
    'Paste an ECLI to target a specific decision.',
    'RS',
    ['ecli', 'identifier'],
  ),
  buildTextExample(
    'Cases in Germany in 2010 with Article 6 violated',
    'Country + article + year',
    'Combine respondent state, year, and article in one sentence.',
    'ECHR',
    ['article', 'year', 'state'],
  ),
  buildTextExample(
    'Rechtspraak Bestuursrecht 2015 instance Raad van State',
    'Domain + instance',
    'Combine a Rechtspraak domain with a specific court instance.',
    'RS',
    ['instance', 'domain'],
  ),
  buildTextExample(
    'ECHR Article 8 non-violated "privacy" 2021',
    'Non-violation signal',
    'Use "non-violated" to target negative findings alongside a quoted topic.',
    'ECHR',
    ['article', 'non-violated', 'keyword'],
  ),
  buildTextExample(
    'Cases with ECLI ECLI:NL:RBAMS and "privacy"',
    'ECLI prefix',
    'Search by an ECLI prefix plus a quoted topic keyword.',
    'RS',
    ['ecli', 'keyword'],
  ),
  buildTextExample(
    'ECHR "fair trial" AND "freedom of expression" 2018',
    'Boolean + multi-topic',
    'Use AND/OR to combine multiple quoted concepts.',
    'ECHR',
    ['boolean', 'keyword'],
  ),
  buildTextExample(
    'Rechtspraak "tax law" between 2012 and 2014',
    'Year range (RS)',
    'Use "between" to set a range with a quoted topic.',
    'RS',
    ['year range', 'keyword'],
  ),
  buildTextExample(
    'ECHR "right to life" Turkey',
    'Keyword + state',
    'Quote a human rights phrase and combine it with a respondent state.',
    'ECHR',
    ['keyword', 'respondent state'],
  ),
  buildTextExample(
    'Rechtspraak "asylum seeker" 2019',
    'Keyword only',
    'Pure keyword search works when it is wrapped in quotes.',
    'RS',
    ['keyword'],
  ),
  buildTextExample(
    'ECHR "inhuman treatment" Turkey between 2014 and 2016',
    'Keyword + range',
    'Combine a quoted phrase with a date range and a state.',
    'ECHR',
    ['keyword', 'date range', 'respondent state'],
  ),
  buildTextExample(
    'Rechtspraak "arbeidsrecht" AND "ontslag" 2018',
    'Boolean keyword',
    'Use AND between two quoted Dutch phrases.',
    'RS',
    ['keyword', 'boolean'],
  ),
  buildTextExample(
    'ECHR Article 6 violated "fair trial" 2016',
    'Article + keyword',
    'Combine an article filter with a quoted phrase.',
    'ECHR',
    ['article', 'keyword'],
  ),
  buildTextExample(
    'Rechtspraak "openbaarheid van bestuur" 2021',
    'Public law keyword',
    'Search for public law topics with Dutch quoted phrases.',
    'RS',
    ['keyword', 'year'],
  ),
  buildTextExample(
    'ECHR "family life" AND "privacy" 2020',
    'Multiple keywords',
    'Multiple quoted phrases are parsed as separate keywords.',
    'ECHR',
    ['keyword', 'boolean'],
  ),
  buildTextExample(
    'Rechtspraak "onteigening" 2017',
    'Property keyword',
    'Use a quoted Dutch property-related phrase.',
    'RS',
    ['keyword'],
  ),
  buildTextExample(
    'ECHR "freedom of expression" 2019',
    'Single keyword',
    'Simple quoted phrases are parsed as keywords.',
    'ECHR',
    ['keyword', 'year'],
  ),
  buildTextExample(
    'Rechtspraak "omgangsregeling" 2018',
    'Family law keyword',
    'Quoted Dutch phrases map to keyword filters.',
    'RS',
    ['keyword', 'year'],
  ),
  buildTextExample(
    'ECHR language ENG judgment date on 2020-05-01',
    'Language + judgment date',
    'Use ISO‑3 language codes and an exact judgment date.',
    'ECHR',
    ['language', 'judgment date'],
  ),
  buildTextExample(
    'ECHR decision date before 2019-06-01 respondent state France',
    'Decision date bound',
    'Filter by decision date before a specific day.',
    'ECHR',
    ['decision date', 'respondent state'],
  ),
  buildTextExample(
    'Rechtspraak selected law BWBR0005537|125 2020',
    'Selected law',
    'Target a specific law identifier (Awb) in Rechtspraak.',
    'RS',
    ['selected laws', 'year'],
  ),
  buildTextExample(
    'Rechtspraak "huurrecht" 2020',
    'Rechtspraak keyword',
    'Search by a Dutch legal topic keyword.',
    'RS',
    ['keyword', 'year'],
  ),
  buildTextExample(
    'title "freedom of expression" date start 2019-01-01 date end 2019-12-31',
    'Title + exact date range',
    'Use Title with explicit date start/end for exact ranges.',
    'MIXED',
    ['title', 'date start', 'date end'],
  ),
  buildTextExample(
    'ECHR "right to life" AND "fair trial" 2019',
    'Multiple keywords (AND)',
    'Combine multiple keyword phrases with AND logic.',
    'ECHR',
    ['keyword', 'boolean'],
  ),
]

// ─── Curated builder examples (15) ──────────────────────────────────────────

export const BUILDER_EXAMPLES: ExampleItem[] = [
  {
    id: genId(),
    title: 'ECHR Article Violations',
    description: 'Combine multiple ECHR-specific filters and a global year rule.',
    group: makeGroup('AND', [
      makeRule('article_violated', '3', 'equals', 'ECHR'),
      makeRule('respondent_state', 'Turkey', 'equals', 'ECHR'),
      makeRule('year', '2014', 'after', 'ANY'),
    ]),
    scope: 'ECHR',
    tags: ['article', 'respondent state', 'year'],
  },
  {
    id: genId(),
    title: 'Rechtspraak domains',
    description: 'Use an OR subgroup to search across multiple domains.',
    group: makeGroup('AND', [
      makeRule('instance', 'Hoge Raad', 'equals', 'RS'),
    ], [
      makeGroup('OR', [
        makeRule('domain', 'Intellectueel-eigendomsrecht', 'equals', 'RS'),
        makeRule('domain', 'Civiel recht', 'equals', 'RS'),
      ]),
    ]),
    scope: 'RS',
    tags: ['domain', 'instance', 'grouping'],
  },
  {
    id: genId(),
    title: 'Mixed source query',
    description: 'Combine a title keyword with an ECLI prefix filter.',
    group: makeGroup('AND', [
      makeRule('title', 'privacy', 'contains', 'ANY'),
      makeRule('ecli', 'ECLI:NL:HR', 'contains', 'ANY'),
    ]),
    scope: 'MIXED',
    tags: ['title', 'ecli', 'any'],
  },
  {
    id: genId(),
    title: 'Mixed: ECHR article + RS domain',
    description: 'Search across both datasets with scoped rules.',
    group: makeGroup('OR', [], [
      makeGroup('AND', [
        makeRule('article_violated', '5', 'equals', 'ECHR'),
        makeRule('year', '2018', 'after', 'ANY'),
      ]),
      makeGroup('AND', [
        makeRule('domain', 'Bestuursrecht', 'equals', 'RS'),
        makeRule('year', '2018', 'after', 'ANY'),
      ]),
    ]),
    scope: 'MIXED',
    tags: ['article', 'domain', 'year'],
  },
  {
    id: genId(),
    title: 'Mixed: respondent state + instance',
    description: 'Combine an ECHR respondent state with a Rechtspraak instance.',
    group: makeGroup('AND', [
      makeRule('year', '2016', 'equals', 'ANY'),
    ], [
      makeGroup('OR', [
        makeRule('respondent_state', 'Italy', 'equals', 'ECHR'),
        makeRule('instance', 'Raad van State', 'equals', 'RS'),
      ]),
    ]),
    scope: 'MIXED',
    tags: ['respondent state', 'instance', 'year'],
  },
  {
    id: genId(),
    title: 'Mixed: OR grouping by dataset',
    description: 'OR between ECHR article filter and Rechtspraak domain filter.',
    group: makeGroup('OR', [], [
      makeGroup('AND', [
        makeRule('article_applied', '8', 'equals', 'ECHR'),
        makeRule('year', '2012', 'after', 'ANY'),
      ]),
      makeGroup('AND', [
        makeRule('domain', 'Belastingrecht', 'equals', 'RS'),
        makeRule('year', '2012', 'after', 'ANY'),
      ]),
    ]),
    scope: 'MIXED',
    tags: ['grouping', 'article', 'domain'],
  },
  {
    id: genId(),
    title: 'Mixed: text + dataset filters',
    description: 'Use full text with dataset-specific filters side by side.',
    group: makeGroup('OR', [], [
      makeGroup('AND', [
        makeRule('text', 'privacy', 'contains', 'ANY'),
        makeRule('article_non_violated', '8', 'equals', 'ECHR'),
      ]),
      makeGroup('AND', [
        makeRule('text', 'privacy', 'contains', 'ANY'),
        makeRule('instance', 'Hoge Raad', 'equals', 'RS'),
      ]),
    ]),
    scope: 'MIXED',
    tags: ['text', 'article', 'instance'],
  },
  {
    id: genId(),
    title: 'ECHR application numbers',
    description: 'Filter by a known application number and a respondent state.',
    group: makeGroup('AND', [
      makeRule('application_number', '46544/99', 'equals', 'ECHR'),
      makeRule('respondent_state', 'Germany', 'equals', 'ECHR'),
    ]),
    scope: 'ECHR',
    tags: ['application number', 'respondent state'],
  },
  {
    id: genId(),
    title: 'Rechtspraak opinion type',
    description: 'Target a specific decision type and domain.',
    group: makeGroup('AND', [
      makeRule('document_type', 'OPI', 'equals', 'RS'),
      makeRule('domain', 'Belastingrecht', 'equals', 'RS'),
    ]),
    scope: 'RS',
    tags: ['document type', 'domain'],
  },
  {
    id: genId(),
    title: 'NOT grouping',
    description: 'Exclude a domain with a NOT group while keeping a global year.',
    group: makeGroup('AND', [
      makeRule('year', '2019', 'equals', 'ANY'),
    ], [
      makeGroup('NOT', [
        makeRule('domain', 'Personen- en familierecht', 'equals', 'RS'),
      ]),
    ]),
    scope: 'RS',
    tags: ['not', 'grouping', 'year'],
  },
  {
    id: genId(),
    title: 'ECHR language + judgment date',
    description: 'Combine ISO‑3 language codes with an exact judgment date.',
    group: makeGroup('AND', [
      makeRule('language', 'ENG', 'equals', 'ECHR'),
      makeRule('date_judgment_start', '2020-05-01', 'equals', 'ECHR'),
    ]),
    scope: 'ECHR',
    tags: ['language', 'judgment date'],
  },
  {
    id: genId(),
    title: 'ECHR judgment date range',
    description: 'Filter by judgment date boundaries.',
    group: makeGroup('AND', [
      makeRule('date_judgment_start', '2018-01-01', 'after', 'ECHR'),
      makeRule('date_judgment_end', '2020-12-31', 'before', 'ECHR'),
    ]),
    scope: 'ECHR',
    tags: ['judgment date', 'range'],
  },
  {
    id: genId(),
    title: 'Rechtspraak domain + year',
    description: 'Filter Rechtspraak by domain and minimum year.',
    group: makeGroup('AND', [
      makeRule('domain', 'Civiel recht', 'equals', 'RS'),
      makeRule('year', '2020', 'after', 'ANY'),
    ]),
    scope: 'RS',
    tags: ['domain', 'year'],
  },
  {
    id: genId(),
    title: 'Exact date bounds',
    description: 'Use explicit start/end dates for precise ranges.',
    group: makeGroup('AND', [
      makeRule('dateStart', '2020-02-01', 'equals', 'ANY'),
      makeRule('dateEnd', '2020-03-15', 'equals', 'ANY'),
    ]),
    scope: 'MIXED',
    tags: ['date start', 'date end'],
  },
]
