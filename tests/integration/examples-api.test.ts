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
import { queryBuilderGroupToSearchQuery } from '~/lib/utils/search-query';
import { buildCombinedPayload } from '~/lib/api/client';
import { SEARCH_EXAMPLES } from '~/lib/utils/search-examples';
import { TEXT_EXAMPLES, BUILDER_EXAMPLES } from '~/lib/utils/curated-examples';
import type { QueryBuilderGroup } from '~/lib/types';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000';
const TIMEOUT = 30_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a text search string → QueryBuilderGroup → SearchQuery → API payload,
 * then POST to the combined endpoint and return the response.
 */
async function executeTextQuery(text: string) {
    const group = parseNaturalLanguageToQueryBuilderGroup(text);
    const parsed = queryBuilderGroupToSearchQuery(group);
    if (parsed.error) throw new Error(`Parse error for "${text}": ${parsed.error}`);
    const query = parsed.query!;

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
async function executeGroupQuery(group: QueryBuilderGroup) {
    const parsed = queryBuilderGroupToSearchQuery(group);
    if (parsed.error) throw new Error(`Parse error for group: ${parsed.error}`);
    const query = parsed.query!;

    const body = buildCombinedPayload(query, group);
    const response = await fetch(`${API_BASE}/api/combined`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    return { response, data, query, group, body };
}

// ─── Curated examples (single source of truth: lib/utils/curated-examples.ts)

const textExamples = TEXT_EXAMPLES
    .filter((e) => e.searchText)
    .map((e) => ({ text: e.searchText!, title: e.title }));

const builderExamples = BUILDER_EXAMPLES
    .map((e) => ({ title: e.title, group: e.group }));

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
                expect(data.nodes.length, `"${example.text}" returned 0 results`).toBeGreaterThan(0);
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
                expect(data.nodes.length, `[${example.title}] returned 0 results`).toBeGreaterThan(0);
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
                expect(data.nodes.length, `"${text}" returned 0 results`).toBeGreaterThan(0);
                console.log(`[suggested] done: ${i + 1}/${SEARCH_EXAMPLES.length}`);
            },
            TIMEOUT
        );
    }
});
