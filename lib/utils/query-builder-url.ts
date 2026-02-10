import type { QueryBuilderGroup, QueryBuilderRule, SourceScope, SearchQuery } from '~/lib/types';
import { createDefaultSearchQuery } from '~/lib/types';
import { defaultScopeForField, isFieldAllowed } from '~/lib/utils/query-builder-config';
import { paramsToSearchQuery, searchQueryToQueryBuilderGroup } from '~/lib/utils/search-query';
import {
    sanitizeFilterValue,
    sanitizeCursor,
    clampPageSize,
    MAX_QB_JSON_LENGTH,
    MAX_RULES,
    MAX_GROUPS,
    MAX_RULES_PER_GROUP,
    MAX_PAGE_SIZE,
} from '~/lib/utils/query-sanitize';

type UrlRule = {
    f: string;
    o: string;
    v: string;
    s: SourceScope;
};

type UrlGroup = {
    op: 'AND' | 'OR' | 'NOT';
    rules: UrlRule[];
};

type UrlPayload = {
    op: 'AND' | 'OR' | 'NOT';
    rules: UrlRule[];
    groups: UrlGroup[];
};

export type QueryBuilderUrlState = {
    group: QueryBuilderGroup;
    pageSize?: number;
    cursor?: string;
    searchString?: string;
    sortBy?: SearchQuery['sortBy'];
    sortDirection?: SearchQuery['sortDirection'];
    page?: number;
};

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function normalizeRule(rule: QueryBuilderRule): UrlRule | null {
    const value = (rule.value || '').trim();
    if (!value) return null;
    const scope = rule.sourceScope || defaultScopeForField(rule.field);
    return {
        f: rule.field,
        o: rule.operator,
        v: value,
        s: scope
    };
}

function serializeGroup(group: QueryBuilderGroup): UrlPayload {
    const rules = group.rules
        .map(normalizeRule)
        .filter((r): r is UrlRule => !!r);

    const groups = group.groups.map((g) => ({
        op: g.operator,
        rules: g.rules
            .map(normalizeRule)
            .filter((r): r is UrlRule => !!r)
    }));

    return {
        op: group.operator,
        rules,
        groups
    };
}

/** Allowed field names (allowlist prevents sending arbitrary keys to the API). */
const ALLOWED_FIELDS = new Set([
    'text', 'title', 'ecli', 'keywords', 'year', 'dateStart', 'dateEnd',
    'source', 'article_violated', 'article_applied', 'article_non_violated',
    'respondent_state', 'application_number', 'document_type', 'importance',
    'language', 'instance', 'domain', 'articles', 'selectedLaws',
    'date_judgment_start', 'date_judgment_end', 'date_decision_start', 'date_decision_end',
]);

/** Allowed operators. */
const ALLOWED_OPERATORS = new Set([
    'contains', 'equals', 'not_contains', 'not_equals',
    'after', 'before', 'lte', 'gte',
]);

/** Allowed scopes. */
const ALLOWED_SCOPES = new Set(['ANY', 'ECHR', 'RS']);

function parseRule(raw: UrlRule): QueryBuilderRule | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const field = String(raw.f || '').trim();
    const operator = String(raw.o || '').trim();
    const value = sanitizeFilterValue(String(raw.v || ''));
    if (!field || !operator || !value) return null;

    // Allowlist field and operator to prevent arbitrary keys reaching the API
    if (!ALLOWED_FIELDS.has(field)) return null;
    if (!ALLOWED_OPERATORS.has(operator)) return null;

    const rawScope = String(raw.s || '').trim();
    const scope = (ALLOWED_SCOPES.has(rawScope) ? rawScope : defaultScopeForField(field)) as SourceScope;
    const normalizedScope = isFieldAllowed(scope, field) ? scope : defaultScopeForField(field);
    return {
        id: genId(),
        field,
        operator,
        value,
        sourceScope: normalizedScope
    };
}

function buildGroupFromPayload(payload: UrlPayload): QueryBuilderGroup {
    // Cap the number of root-level rules
    const rootRules = (payload.rules || [])
        .slice(0, MAX_RULES)
        .map(parseRule)
        .filter((r): r is QueryBuilderRule => !!r);

    const root: QueryBuilderGroup = {
        id: genId(),
        operator: payload.op,
        rules: rootRules,
        groups: []
    };

    // Cap the number of nested groups and rules per group
    const groups = (payload.groups || []).slice(0, MAX_GROUPS);
    for (const group of groups) {
        if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
        if (!['AND', 'OR', 'NOT'].includes(group.op)) continue;
        const groupRules = (group.rules || [])
            .slice(0, MAX_RULES_PER_GROUP)
            .map(parseRule)
            .filter((r): r is QueryBuilderRule => !!r);
        root.groups.push({
            id: genId(),
            operator: group.op,
            rules: groupRules,
            groups: []
        });
    }

    if (root.rules.length === 0 && root.groups.length === 0) {
        root.rules.push({ id: genId(), field: 'text', operator: 'contains', value: '', sourceScope: 'ANY' });
    }

    return root;
}

export function queryBuilderGroupToParams(
    group: QueryBuilderGroup,
    opts: {
        pageSize?: number;
        cursor?: string;
        searchString?: string;
        sortBy?: SearchQuery['sortBy'];
        sortDirection?: SearchQuery['sortDirection'];
        page?: number;
    } = {}
): URLSearchParams {
    const params = new URLSearchParams();
    const payload = serializeGroup(group);
    params.set('qb', JSON.stringify(payload));

    const defaults = createDefaultSearchQuery();
    if (opts.pageSize && opts.pageSize !== defaults.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.searchString) params.set('searchString', opts.searchString);
    if (opts.sortBy && opts.sortBy !== defaults.sortBy) params.set('sortBy', opts.sortBy);
    if (opts.sortDirection && opts.sortDirection !== defaults.sortDirection) params.set('sortDirection', opts.sortDirection);
    if (opts.page && opts.page > 1) params.set('page', String(opts.page));

    return params;
}

export function paramsToQueryBuilderState(params: URLSearchParams): { state?: QueryBuilderUrlState; error?: string } {
    const qb = params.get('qb');
    if (qb) {
        // ── Guard: max JSON payload size ──
        if (qb.length > MAX_QB_JSON_LENGTH) return { error: 'Query builder payload too large.' };

        let payload: UrlPayload | null = null;
        try {
            payload = JSON.parse(qb);
        } catch {
            return { error: 'Invalid query builder payload.' };
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'Invalid query builder payload.' };
        if (!['AND', 'OR', 'NOT'].includes(payload.op)) return { error: 'Invalid query builder operator.' };
        if (!Array.isArray(payload.rules) || !Array.isArray(payload.groups)) return { error: 'Invalid query builder payload.' };

        const group = buildGroupFromPayload(payload);

        // ── Pagination & sort (validated) ──
        const pageSize = params.get('pageSize');
        const cursor = sanitizeCursor(params.get('cursor') || params.get('echrCursor') || params.get('rsCursor') || undefined);
        const searchString = params.get('searchString')
            ? sanitizeFilterValue(params.get('searchString')!)
            : undefined;

        const rawSortBy = params.get('sortBy');
        const sortBy = rawSortBy && ['date', 'citations'].includes(rawSortBy)
            ? rawSortBy as SearchQuery['sortBy']
            : undefined;

        const rawSortDir = params.get('sortDirection');
        const sortDirection = rawSortDir && ['asc', 'desc'].includes(rawSortDir)
            ? rawSortDir as SearchQuery['sortDirection']
            : undefined;

        const page = params.get('page');
        const parsedPage = page ? Math.max(1, Math.min(Math.round(Number(page)) || 1, 10_000)) : undefined;

        if (pageSize) {
            const num = Number(pageSize);
            if (!Number.isInteger(num) || num < 1) return { error: 'Invalid pageSize value.' };
            return {
                state: {
                    group,
                    pageSize: clampPageSize(num),
                    cursor,
                    searchString,
                    sortBy,
                    sortDirection,
                    page: parsedPage,
                }
            };
        }
        return {
            state: {
                group,
                cursor,
                searchString,
                sortBy,
                sortDirection,
                page: parsedPage,
            }
        };
    }

    // Fallback to legacy params (ignore free-text query)
    // paramsToSearchQuery already applies full sanitisation
    const legacy = paramsToSearchQuery(params);
    if (!legacy.query) return { error: legacy.error || 'Invalid parameters.' };
    legacy.query.text = '';
    legacy.query.scoped.echr.text = '';
    legacy.query.scoped.rs.text = '';
    const group = searchQueryToQueryBuilderGroup(legacy.query);
    const searchString = params.get('searchString')
        ? sanitizeFilterValue(params.get('searchString')!)
        : undefined;
    const cursor = sanitizeCursor(params.get('cursor') || params.get('echrCursor') || params.get('rsCursor') || undefined);

    const rawSortBy = params.get('sortBy');
    const sortBy = rawSortBy && ['date', 'citations'].includes(rawSortBy)
        ? rawSortBy as SearchQuery['sortBy']
        : undefined;

    const rawSortDir = params.get('sortDirection');
    const sortDirection = rawSortDir && ['asc', 'desc'].includes(rawSortDir)
        ? rawSortDir as SearchQuery['sortDirection']
        : undefined;

    const page = params.get('page');
    const parsedPage = page ? Math.max(1, Math.min(Math.round(Number(page)) || 1, 10_000)) : undefined;
    return {
        state: {
            group,
            pageSize: legacy.query.pageSize,
            cursor: cursor || legacy.query.cursor,
            searchString,
            sortBy: sortBy || legacy.query.sortBy,
            sortDirection: sortDirection || legacy.query.sortDirection,
            page: parsedPage && parsedPage > 0 ? parsedPage : legacy.query.page,
        }
    };
}
