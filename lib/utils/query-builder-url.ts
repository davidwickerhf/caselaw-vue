import type { QueryBuilderGroup, QueryBuilderRule, SourceScope, SearchQuery } from '~/lib/types';
import { createDefaultSearchQuery } from '~/lib/types';
import { defaultScopeForField, isFieldAllowed } from '~/lib/utils/query-builder-config';
import { paramsToSearchQuery, searchQueryToQueryBuilderGroup } from '~/lib/utils/search-query';

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
    degreesSource?: number;
    degreesTarget?: number;
    isSubgraph?: boolean;
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

function parseRule(raw: UrlRule): QueryBuilderRule | null {
    if (!raw || typeof raw !== 'object') return null;
    const field = String(raw.f || '').trim();
    const operator = String(raw.o || '').trim();
    const value = String(raw.v || '').trim();
    if (!field || !operator || !value) return null;
    const scope = (raw.s || defaultScopeForField(field)) as SourceScope;
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
    const root: QueryBuilderGroup = {
        id: genId(),
        operator: payload.op,
        rules: payload.rules.map(parseRule).filter((r): r is QueryBuilderRule => !!r),
        groups: []
    };

    for (const group of payload.groups) {
        root.groups.push({
            id: genId(),
            operator: group.op,
            rules: group.rules.map(parseRule).filter((r): r is QueryBuilderRule => !!r),
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
        degreesSource?: number;
        degreesTarget?: number;
        isSubgraph?: boolean;
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
    if (typeof opts.degreesSource === 'number' && opts.degreesSource !== defaults.degreesSource) {
        params.set('degreesSource', String(opts.degreesSource));
    }
    if (typeof opts.degreesTarget === 'number' && opts.degreesTarget !== defaults.degreesTarget) {
        params.set('degreesTarget', String(opts.degreesTarget));
    }
    if (typeof opts.isSubgraph === 'boolean' && opts.isSubgraph !== defaults.isSubgraph) {
        params.set('isSubgraph', opts.isSubgraph ? '1' : '0');
    }

    return params;
}

export function paramsToQueryBuilderState(params: URLSearchParams): { state?: QueryBuilderUrlState; error?: string } {
    const qb = params.get('qb');
    if (qb) {
        let payload: UrlPayload | null = null;
        try {
            payload = JSON.parse(qb);
        } catch {
            return { error: 'Invalid query builder payload.' };
        }

        if (!payload || typeof payload !== 'object') return { error: 'Invalid query builder payload.' };
        if (!['AND', 'OR', 'NOT'].includes(payload.op)) return { error: 'Invalid query builder operator.' };
        if (!Array.isArray(payload.rules) || !Array.isArray(payload.groups)) return { error: 'Invalid query builder payload.' };

        const group = buildGroupFromPayload(payload);
        const pageSize = params.get('pageSize');
        const cursor = params.get('cursor') || params.get('echrCursor') || params.get('rsCursor') || undefined;
        const searchString = params.get('searchString') || undefined;
        const sortBy = params.get('sortBy') as SearchQuery['sortBy'] | null;
        const sortDirection = params.get('sortDirection') as SearchQuery['sortDirection'] | null;
        const page = params.get('page');
        const parsedPage = page ? Number(page) : undefined;
        const degreesSourceRaw = params.get('degreesSource');
        const degreesTargetRaw = params.get('degreesTarget');
        const isSubgraphRaw = params.get('isSubgraph');
        const degreesSource = degreesSourceRaw ? Number(degreesSourceRaw) : undefined;
        const degreesTarget = degreesTargetRaw ? Number(degreesTargetRaw) : undefined;
        if (degreesSource !== undefined && (!Number.isInteger(degreesSource) || degreesSource < 0 || degreesSource > 5)) {
            return { error: 'Invalid degreesSource value.' };
        }
        if (degreesTarget !== undefined && (!Number.isInteger(degreesTarget) || degreesTarget < 0 || degreesTarget > 5)) {
            return { error: 'Invalid degreesTarget value.' };
        }
        const isSubgraph = isSubgraphRaw === '1' || isSubgraphRaw === 'true';
        if (pageSize) {
            const num = Number(pageSize);
            if (!Number.isInteger(num) || num < 1) return { error: 'Invalid pageSize value.' };
            return {
                state: {
                    group,
                    pageSize: num,
                    cursor,
                    searchString,
                    sortBy: sortBy || undefined,
                    sortDirection: sortDirection || undefined,
                    page: parsedPage && parsedPage > 0 ? parsedPage : undefined,
                    degreesSource: Number.isFinite(degreesSource) ? degreesSource : undefined,
                    degreesTarget: Number.isFinite(degreesTarget) ? degreesTarget : undefined,
                    isSubgraph: isSubgraphRaw ? isSubgraph : undefined
                }
            };
        }
        return {
            state: {
                group,
                cursor,
                searchString,
                sortBy: sortBy || undefined,
                sortDirection: sortDirection || undefined,
                page: parsedPage && parsedPage > 0 ? parsedPage : undefined,
                degreesSource: Number.isFinite(degreesSource) ? degreesSource : undefined,
                degreesTarget: Number.isFinite(degreesTarget) ? degreesTarget : undefined,
                isSubgraph: isSubgraphRaw ? isSubgraph : undefined
            }
        };
    }

    // Fallback to legacy params (ignore free-text query)
    const legacy = paramsToSearchQuery(params);
    if (!legacy.query) return { error: legacy.error || 'Invalid parameters.' };
    legacy.query.text = '';
    legacy.query.scoped.echr.text = '';
    legacy.query.scoped.rs.text = '';
    const group = searchQueryToQueryBuilderGroup(legacy.query);
    const searchString = params.get('searchString') || undefined;
    const cursor = params.get('cursor') || params.get('echrCursor') || params.get('rsCursor') || undefined;
    const sortBy = params.get('sortBy') as SearchQuery['sortBy'] | null;
    const sortDirection = params.get('sortDirection') as SearchQuery['sortDirection'] | null;
    const page = params.get('page');
    const parsedPage = page ? Number(page) : undefined;
    const degreesSourceRaw = params.get('degreesSource');
    const degreesTargetRaw = params.get('degreesTarget');
    const isSubgraphRaw = params.get('isSubgraph');
    const degreesSource = degreesSourceRaw ? Number(degreesSourceRaw) : undefined;
    const degreesTarget = degreesTargetRaw ? Number(degreesTargetRaw) : undefined;
    if (degreesSource !== undefined && (!Number.isInteger(degreesSource) || degreesSource < 0 || degreesSource > 5)) {
        return { error: 'Invalid degreesSource value.' };
    }
    if (degreesTarget !== undefined && (!Number.isInteger(degreesTarget) || degreesTarget < 0 || degreesTarget > 5)) {
        return { error: 'Invalid degreesTarget value.' };
    }
    const isSubgraph = isSubgraphRaw === '1' || isSubgraphRaw === 'true';
    return {
        state: {
            group,
            pageSize: legacy.query.pageSize,
            cursor: cursor || legacy.query.cursor,
            searchString,
            sortBy: sortBy || legacy.query.sortBy,
            sortDirection: sortDirection || legacy.query.sortDirection,
            page: parsedPage && parsedPage > 0 ? parsedPage : legacy.query.page,
            degreesSource: Number.isFinite(degreesSource) ? degreesSource : legacy.query.degreesSource,
            degreesTarget: Number.isFinite(degreesTarget) ? degreesTarget : legacy.query.degreesTarget,
            isSubgraph: isSubgraphRaw ? isSubgraph : legacy.query.isSubgraph
        }
    };
}
