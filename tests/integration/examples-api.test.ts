/**
 * Integration tests for all example queries and suggested searches.
 *
 * Each test:
 *   1. Takes a search string (or pre-built QueryBuilderGroup).
 *   2. Runs it through the same parser the search bar uses.
 *   3. Converts the result to a SearchQuery.
 *   4. Builds the API payload and sends it to the combined endpoint.
 *   5. Verifies the response has no errors (and ideally returns results).
 *
 * These tests require the citations-api to be running on localhost:3000.
 */

import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageToQueryBuilderGroup } from '~/lib/parser/nl-query-parser';
import { parseSearchInput } from '~/lib/parser/search-parser';
import { queryBuilderGroupToSearchQuery } from '~/lib/utils/search-query';
import { buildCombinedPayload } from '~/lib/api/client';
import { SEARCH_EXAMPLES } from '~/lib/utils/search-examples';
import { defaultScopeForField } from '~/lib/utils/query-builder-config';
import type { QueryBuilderGroup, SearchQuery } from '~/lib/types';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000';
const TIMEOUT = 30_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function makeRule(
    field: string,
    value: string,
    operator = 'contains',
    scope?: 'ANY' | 'ECHR' | 'RS'
) {
    return {
        id: genId(),
        field,
        operator,
        value,
        sourceScope: scope ?? defaultScopeForField(field),
    };
}

function makeGroup(
    operator: 'AND' | 'OR' | 'NOT',
    rules: ReturnType<typeof makeRule>[],
    groups: QueryBuilderGroup[] = []
): QueryBuilderGroup {
    return { id: genId(), operator, rules, groups };
}

function degreesFromText(text: string) {
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

/**
 * Parse a text search string → QueryBuilderGroup → SearchQuery → API payload,
 * then POST to the combined endpoint and return the response.
 */
async function executeTextQuery(text: string) {
    const group = parseNaturalLanguageToQueryBuilderGroup(text);
    const parsed = queryBuilderGroupToSearchQuery(group);
    if (parsed.error) throw new Error(`Parse error for "${text}": ${parsed.error}`);
    const query = parsed.query!;
    const degrees = degreesFromText(text);
    query.degreesSource = degrees.degreesSource ?? 0;
    query.degreesTarget = degrees.degreesTarget ?? 0;
    query.isSubgraph = degrees.isSubgraph ?? false;

    const body = buildCombinedPayload(query, group);
    const response = await fetch(`${API_BASE}/api/combined`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    return { response, data, query, group, body };
}

/**
 * Take a pre-built QueryBuilderGroup → SearchQuery → API payload,
 * then POST and return the response.
 */
async function executeGroupQuery(
    group: QueryBuilderGroup,
    overrides?: { degreesSource?: number; degreesTarget?: number; isSubgraph?: boolean }
) {
    const parsed = queryBuilderGroupToSearchQuery(group);
    if (parsed.error) throw new Error(`Parse error for group: ${parsed.error}`);
    const query = parsed.query!;
    query.degreesSource = overrides?.degreesSource ?? 0;
    query.degreesTarget = overrides?.degreesTarget ?? 0;
    query.isSubgraph = overrides?.isSubgraph ?? false;

    const body = buildCombinedPayload(query, group);
    const response = await fetch(`${API_BASE}/api/combined`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    return { response, data, query, group, body };
}

// ─── Text examples (from pages/examples.vue) ───────────────────────────────

const textExamples: Array<{ text: string; title: string; degreesSource?: number; degreesTarget?: number }> = [
    { text: 'Article 3 violated Turkey between 2014 and 2016', title: 'Article + date range' },
    { text: 'ECHR respondent state Armenia importance 1', title: 'Source + importance' },
    { text: 'Rechtspraak "intellectual property" 2020', title: 'Rechtspraak topical search' },
    { text: 'ECLI:NL:HR:2019:1234', title: 'Direct ECLI lookup' },
    { text: 'Cases in Germany in 2010 with Article 6 violated', title: 'Country + article + year' },
    { text: 'Rechtspraak Bestuursrecht 2015 instance Raad van State', title: 'Domain + instance' },
    { text: 'ECHR Article 8 non-violated "privacy" 2021', title: 'Non-violation signal' },
    { text: 'Cases with ECLI ECLI:NL:RBAMS and "privacy"', title: 'ECLI prefix' },
    { text: 'ECHR "fair trial" AND "freedom of expression" 2018', title: 'Boolean + multi-topic' },
    { text: 'Rechtspraak "tax law" between 2012 and 2014', title: 'Year range (RS)' },
    { text: 'ECHR "right to life" Germany 2010', title: 'Keyword + state' },
    { text: 'Rechtspraak "asylum seeker" 2019', title: 'Keyword only' },
    { text: 'ECHR "inhuman treatment" Turkey between 2014 and 2016', title: 'Keyword + range' },
    { text: 'Rechtspraak "contract breach" AND "damages" 2018', title: 'Boolean keyword' },
    { text: 'ECHR Article 6 violated "fair trial" 2016', title: 'Article + keyword' },
    { text: 'Rechtspraak "freedom of information" 2021', title: 'Public law keyword' },
    { text: 'ECHR "family life" AND "privacy" 2020', title: 'Multiple keywords' },
    { text: 'Rechtspraak "eminent domain" 2017', title: 'Property keyword' },
    { text: 'ECHR "freedom of expression" 2019', title: 'Single keyword' },
    { text: 'Rechtspraak "child custody" 2013', title: 'Family law keyword' },
    { text: 'ECHR language ENG judgment date on 2020-05-01', title: 'Language + judgment date' },
    { text: 'ECHR decision date before 2019-06-01 respondent state France', title: 'Decision date bound' },
    { text: 'Rechtspraak selected law BWBX1234|56 2020', title: 'Selected law' },
    { text: 'Rechtspraak articles "BWBR0001830" 2018', title: 'Rechtspraak articles' },
    { text: 'title "freedom of expression" date start 2019-01-01 date end 2019-12-31', title: 'Title + exact date range' },
    { text: 'ECHR Article 2 violated Italy depth 2', title: 'Graph expansion (depth)', degreesSource: 2, degreesTarget: 2 },
];

// ─── Builder examples (from pages/examples.vue) ────────────────────────────

const builderExamples: Array<{ title: string; group: QueryBuilderGroup }> = [
    {
        title: 'ECHR Article Violations',
        group: makeGroup('AND', [
            makeRule('article_violated', '3', 'equals', 'ECHR'),
            makeRule('respondent_state', 'Turkey', 'equals', 'ECHR'),
            makeRule('year', '2014', 'after', 'ANY'),
        ]),
    },
    {
        title: 'Rechtspraak domains',
        group: makeGroup(
            'AND',
            [makeRule('instance', 'Hoge Raad', 'equals', 'RS')],
            [
                makeGroup('OR', [
                    makeRule('domain', 'Intellectueel-eigendomsrecht', 'equals', 'RS'),
                    makeRule('domain', 'Civiel recht', 'equals', 'RS'),
                ]),
            ]
        ),
    },
    {
        title: 'Mixed source query',
        group: makeGroup('AND', [
            makeRule('title', 'privacy', 'contains', 'ANY'),
            makeRule('ecli', 'ECLI:NL:HR', 'contains', 'ANY'),
        ]),
    },
    {
        title: 'Mixed: ECHR article + RS domain',
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
    },
    {
        title: 'Mixed: respondent state + instance',
        group: makeGroup('OR', [], [
            makeGroup('AND', [
                makeRule('respondent_state', 'Italy', 'equals', 'ECHR'),
                makeRule('year', '2016', 'equals', 'ANY'),
            ]),
            makeGroup('AND', [
                makeRule('instance', 'Raad van State', 'equals', 'RS'),
                makeRule('year', '2016', 'equals', 'ANY'),
            ]),
        ]),
    },
    {
        title: 'Mixed: OR grouping by dataset',
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
    },
    {
        title: 'Mixed: text + dataset filters',
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
    },
    {
        title: 'ECHR application numbers',
        group: makeGroup('AND', [
            makeRule('application_number', '23459/03', 'equals', 'ECHR'),
            makeRule('respondent_state', 'Germany', 'equals', 'ECHR'),
        ]),
    },
    {
        title: 'Rechtspraak opinion type',
        group: makeGroup('AND', [
            makeRule('document_type', 'OPI', 'equals', 'RS'),
            makeRule('domain', 'Belastingrecht', 'equals', 'RS'),
        ]),
    },
    {
        title: 'NOT grouping',
        group: makeGroup(
            'AND',
            [makeRule('year', '2019', 'equals', 'ANY')],
            [makeGroup('NOT', [makeRule('domain', 'Personen- en familierecht', 'equals', 'RS')])]
        ),
    },
    {
        title: 'ECHR language + judgment date',
        group: makeGroup('AND', [
            makeRule('language', 'ENG', 'equals', 'ECHR'),
            makeRule('date_judgment_start', '2020-05-01', 'equals', 'ECHR'),
        ]),
    },
    {
        title: 'ECHR decision date range',
        group: makeGroup('AND', [
            makeRule('date_decision_start', '2019-01-01', 'after', 'ECHR'),
            makeRule('date_decision_end', '2019-12-31', 'before', 'ECHR'),
        ]),
    },
    {
        title: 'Rechtspraak selected laws + articles',
        group: makeGroup('AND', [
            makeRule('selectedLaws', 'BWBX1234|56', 'equals', 'RS'),
            makeRule('articles', 'BWBR0001830', 'contains', 'RS'),
        ]),
    },
    {
        title: 'Exact date bounds',
        group: makeGroup('AND', [
            makeRule('dateStart', '2020-02-01', 'equals', 'ANY'),
            makeRule('dateEnd', '2020-03-15', 'equals', 'ANY'),
        ]),
    },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe.sequential('Text examples → parse → API', () => {
    for (const example of textExamples) {
        it(
            `[${example.title}] "${example.text}"`,
            async () => {
                console.log(`[text] start: ${example.title}`);
                const { response, data } = await executeTextQuery(example.text);
                expect(response.ok, `HTTP ${response.status}: ${JSON.stringify(data)}`).toBe(true);
                expect(data.error).toBeUndefined();
                expect(data.nodes).toBeDefined();
                expect(Array.isArray(data.nodes)).toBe(true);
                console.log(`[text] done: ${example.title}`);
            },
            TIMEOUT
        );
    }
});

describe.sequential('Builder examples → API', () => {
    for (const example of builderExamples) {
        it(
            `[${example.title}]`,
            async () => {
                console.log(`[builder] start: ${example.title}`);
                const { response, data } = await executeGroupQuery(example.group);
                expect(response.ok, `HTTP ${response.status}: ${JSON.stringify(data)}`).toBe(true);
                expect(data.error).toBeUndefined();
                expect(data.nodes).toBeDefined();
                expect(Array.isArray(data.nodes)).toBe(true);
                console.log(`[builder] done: ${example.title}`);
            },
            TIMEOUT
        );
    }
});

describe.sequential('Suggested searches (SEARCH_EXAMPLES) → parse → API', () => {
    // SEARCH_EXAMPLES generates 200 queries. We test all of them.
    // Each is a natural language string that the landing page shows as suggestions.

    for (let i = 0; i < SEARCH_EXAMPLES.length; i++) {
        const text = SEARCH_EXAMPLES[i];

        it(
            `[${i}] "${text}"`,
            async () => {
                console.log(`[suggested] start: ${i + 1}/${SEARCH_EXAMPLES.length}`);
                // Step 1: Parse to QueryBuilderGroup (same as the search bar)
                const group = parseNaturalLanguageToQueryBuilderGroup(text);
                expect(group).toBeDefined();
                expect(group.rules.length + group.groups.length).toBeGreaterThan(0);

                // Step 2: Convert to SearchQuery
                const parsed = queryBuilderGroupToSearchQuery(group);
                expect(parsed.error, `Parse error: ${parsed.error}`).toBeUndefined();
                const query = parsed.query!;

                // Extract degree info the same way as the search bar
                const degrees = degreesFromText(text);
                query.degreesSource = degrees.degreesSource ?? 0;
                query.degreesTarget = degrees.degreesTarget ?? 0;
                query.isSubgraph = degrees.isSubgraph ?? false;

                // Step 3: Build payload and call API
                const body = buildCombinedPayload(query, group);
                const response = await fetch(`${API_BASE}/api/combined`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const data = await response.json();
                expect(response.ok, `HTTP ${response.status} for "${text}": ${JSON.stringify(data)}`).toBe(true);
                expect(data.error).toBeUndefined();
                expect(data.nodes).toBeDefined();
                expect(Array.isArray(data.nodes)).toBe(true);
                console.log(`[suggested] done: ${i + 1}/${SEARCH_EXAMPLES.length}`);
            },
            TIMEOUT
        );
    }
});
