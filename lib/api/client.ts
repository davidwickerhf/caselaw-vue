import type { Citation, SearchQuery, ApiNetworkResponse, ApiNode, QueryBuilderGroup, ApiEdge, ApiEdgesPagination, SourceScope } from '~/lib/types';
import { respondentCodeToName, respondentStateToCode } from '~/lib/utils/respondent-state';
import { defaultScopeForField, isFieldAllowed } from '~/lib/utils/query-builder-config';
import { RECHTSPRAAK_DOMAIN_ALIASES, RECHTSPRAAK_DOMAINS } from '~/lib/utils/constants';

const API_BASE = 'http://localhost:3000';

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_EDGE_PAGE_SIZE = 1000;

type CombinedNode = ApiNode & { data: Record<string, unknown> & { dataset?: string; isResult?: string | boolean } };
type CombinedResponse = ApiNetworkResponse & { edges?: ApiEdge[]; edgesPagination?: ApiEdgesPagination };

const RS_DOC_TYPES = new Set(['DEC', 'OPI']);
const ECHR_DOC_TYPES = new Set(['HEJUD', 'HEDEC', 'HECOM', 'HEINF', 'HECJUD', 'HECDEC', 'HECCOM', 'HECINF']);
const COMMON_FIELDS = new Set(['text', 'title', 'ecli', 'keywords', 'year', 'dateStart', 'dateEnd', 'source']);
const DOMAIN_SET = new Set(RECHTSPRAAK_DOMAINS.map((d) => d.toLowerCase()));
const DOMAIN_ALIAS_MAP = new Map(
    RECHTSPRAAK_DOMAIN_ALIASES.map((entry) => [entry.pattern.toLowerCase(), entry.value])
);

function normalizeDomainValue(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (DOMAIN_SET.has(lower)) {
        return RECHTSPRAAK_DOMAINS.find((d) => d.toLowerCase() === lower) || trimmed;
    }
    return DOMAIN_ALIAS_MAP.get(lower) || null;
}

function normalizeSourceValue(value: string): string | null {
    const upper = value.trim().toUpperCase();
    if (!upper) return null;
    if (upper === 'RS' || upper === 'RECHTSPRAAK') return 'RS';
    if (upper === 'ECHR' || upper === 'HUDOC') return 'ECHR';
    if (upper === 'ANY' || upper === 'BOTH' || upper === 'ALL') return 'ANY';
    return null;
}

function normalizeYearValue(value: string): string | null {
    const num = Number(value);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(num) || num < 1900 || num > currentYear) return null;
    return String(num);
}

function normalizeDateValue(value: string): string | null {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    if (date > new Date()) return null;
    return trimmed;
}

function normalizeLanguageValue(value: string): string | null {
    const trimmed = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) return null;
    return trimmed;
}

function normalizeSelectedLaw(value: string): string | null {
    const trimmed = value.trim();
    if (!/^BWBX\d+\|\d+$/i.test(trimmed)) return null;
    return trimmed.toUpperCase();
}

function normalizeImportanceValue(value: string): string | null {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 4) return null;
    return String(num);
}

function normalizeDocumentType(value: string, scope: SourceScope): { value: string; scope: SourceScope } | null {
    const upper = value.trim().toUpperCase();
    if (!upper) return null;
    if (scope === 'ANY') {
        if (RS_DOC_TYPES.has(upper)) return { value: upper, scope: 'RS' };
        if (ECHR_DOC_TYPES.has(upper)) return { value: upper, scope: 'ECHR' };
        return null;
    }
    if (scope === 'RS') return RS_DOC_TYPES.has(upper) ? { value: upper, scope } : null;
    return ECHR_DOC_TYPES.has(upper) ? { value: upper, scope } : null;
}

function normalizeRuleScope(scope: SourceScope, field: string): SourceScope {
    if (isFieldAllowed(scope, field)) return scope;
    return defaultScopeForField(field);
}

function normalizeRuleValue(field: string, value: string, scope: SourceScope): { value: string; scope: SourceScope } | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    switch (field) {
        case 'respondent_state': {
            const code = respondentStateToCode(trimmed);
            if (!code) return null;
            return { value: code, scope };
        }
        case 'domain': {
            const normalized = normalizeDomainValue(trimmed);
            if (!normalized) return null;
            return { value: normalized, scope };
        }
        case 'year': {
            const year = normalizeYearValue(trimmed);
            if (!year) return null;
            return { value: year, scope };
        }
        case 'dateStart':
        case 'dateEnd':
        case 'date_judgment_start':
        case 'date_judgment_end':
        case 'date_decision_start':
        case 'date_decision_end': {
            const date = normalizeDateValue(trimmed);
            if (!date) return null;
            return { value: date, scope };
        }
        case 'importance': {
            const imp = normalizeImportanceValue(trimmed);
            if (!imp) return null;
            return { value: imp, scope };
        }
        case 'document_type': {
            return normalizeDocumentType(trimmed, scope);
        }
        case 'source': {
            const src = normalizeSourceValue(trimmed);
            if (!src) return null;
            return { value: src, scope };
        }
        case 'language': {
            const lang = normalizeLanguageValue(trimmed);
            if (!lang) return null;
            return { value: lang, scope };
        }
        case 'selectedLaws': {
            const law = normalizeSelectedLaw(trimmed);
            if (!law) return null;
            return { value: law, scope };
        }
        default:
            return { value: trimmed, scope };
    }
}

function serializeQueryBuilder(group: QueryBuilderGroup) {
    const rules = group.rules
        .flatMap((r) => {
            const field = String(r.field || '').trim();
            const operator = String(r.operator || '').trim();
            const rawValue = String(r.value || '').trim();
            if (!field || !operator || !rawValue) return [];

            let scope = normalizeRuleScope((r.sourceScope || defaultScopeForField(field)) as SourceScope, field);
            if (scope === 'ANY' && !COMMON_FIELDS.has(field) && field !== 'document_type') {
                scope = defaultScopeForField(field);
            }

            const normalized = normalizeRuleValue(field, rawValue, scope);
            if (!normalized) return [];

            return [{ field, operator, value: normalized.value, sourceScope: normalized.scope }];
        });

    const groups = group.groups.map((g) => ({
        op: g.operator,
        rules: g.rules.flatMap((r) => {
            const field = String(r.field || '').trim();
            const operator = String(r.operator || '').trim();
            const rawValue = String(r.value || '').trim();
            if (!field || !operator || !rawValue) return [];

            let scope = normalizeRuleScope((r.sourceScope || defaultScopeForField(field)) as SourceScope, field);
            if (scope === 'ANY' && !COMMON_FIELDS.has(field) && field !== 'document_type') {
                scope = defaultScopeForField(field);
            }

            const normalized = normalizeRuleValue(field, rawValue, scope);
            if (!normalized) return [];

            return [{ field, operator, value: normalized.value, sourceScope: normalized.scope }];
        })
    }));

    return {
        op: group.operator,
        rules,
        groups
    };
}

/**
 * Transform an ECHR API node into our Citation type.
 */
function transformEchrNode(node: ApiNode): Citation {
    const d = node.data;
    const ecli = (d.ecli as string) || node.id;
    const dateJudgment = d.date_judgment as string | undefined;
    const dateDecision = d.date_decision as string | undefined;
    const dateStr = dateJudgment || dateDecision || '';
    const year = dateStr ? new Date(dateStr).getFullYear() : 0;
    const cites = (d.cites as string[]) || [];
    const citedBy = (d.cited_by as string[]) || [];

    const respondentState = typeof d.respondent_state === 'string'
        ? respondentCodeToName(d.respondent_state) || d.respondent_state
        : undefined;

    return {
        id: ecli,
        ecli,
        year,
        date: dateStr ? dateStr.split('T')[0] : undefined,
        date_judgment: dateJudgment ? (dateJudgment as string).split('T')[0] : undefined,
        date_decision: dateDecision ? (dateDecision as string).split('T')[0] : undefined,
        summary: (d.headnote as string) || (d.conclusion as string) || '',
        instance: '',
        domain: '',
        domains: [],
        nCited: citedBy.length,
        nCiting: cites.length,
        topics: '',
        document_type: (d.document_type as string) || '',
        procedure_type: '',
        url_publication: (d.url_publication as string) || `https://hudoc.echr.coe.int/eng?i=${d.itemid || ''}`,
        source: 'HUDOC',
        itemid: d.itemid as string | undefined,
        language: d.language as string | undefined,
        languages: d.languages as Record<string, string> | undefined,
        respondent_state: respondentState,
        application_number: d.application_number as string | undefined,
        article_violated: (d.article_violated as string[]) || undefined,
        article_applied: (d.article_applied as string[]) || undefined,
        article_non_violated: (d.article_non_violated as string[]) || undefined,
        importance: d.importance as number | undefined,
        conclusion: d.conclusion as string | undefined,
        keywords: (d.keywords as string[]) || undefined,
        title: (d.title as string) || (d.headnote as string) || undefined,
        headnote: d.headnote as string | undefined,
        cites,
        cited_by: citedBy
    };
}

/**
 * Transform a Network (Rechtspraak) API node into our Citation type.
 */
function transformNetworkNode(node: ApiNode): Citation {
    const d = node.data;
    const ecli = (d.ecli as string) || node.id;
    const dateDecision = d.date_decision as string | undefined;
    const dateStr = dateDecision || '';
    const year = dateStr ? new Date(dateStr).getFullYear() : 0;
    const cites = (d.cites as string[]) || [];
    const citedBy = (d.cited_by as string[]) || [];
    const rawDomains = (d.domains as string[]) || [];

    return {
        id: ecli,
        ecli,
        year,
        date: dateStr ? dateStr.split('T')[0] : undefined,
        date_decision: dateDecision ? dateDecision.split('T')[0] : undefined,
        summary: (d.summary as string) || '',
        instance: (d.instance as string) || '',
        domain: rawDomains[0] || '',
        domains: rawDomains,
        nCited: citedBy.length,
        nCiting: cites.length,
        topics: '',
        document_type: (d.document_type as string) || '',
        procedure_type: (d.procedure_type as string) || '',
        url_publication: (d.url_publication as string) || '',
        source: 'Rechtspraak',
        legal_provisions: (d.legal_provisions as string[]) || undefined,
        predecessor_successor_cases: d.predecessor_successor_cases as string | undefined,
        ecli_decision: d.ecli_decision as string | undefined,
        ecli_opinion: d.ecli_opinion as string | undefined,
        cites,
        cited_by: citedBy
    };
}

/**
 * Result from a single API page fetch, including cursor for next page.
 */
export type PageResult = {
    citations: Citation[];
    nextCursor?: string;
    total?: number;
    totalIsExact?: boolean;
    edges?: ApiEdge[];
    edgesPagination?: ApiEdgesPagination;
};

/**
 * Fetch a single page from the ECHR API.
 */
export function buildCombinedPayload(
    query: SearchQuery,
    group: QueryBuilderGroup,
    pageSize = DEFAULT_PAGE_SIZE,
    cursor?: string,
    edgesCursor?: string
) {
    const sortBy = query.sortBy === 'relevance' ? 'relevance' : 'date';
    const payload: {
        queryBuilder: ReturnType<typeof serializeQueryBuilder>;
        degreesSource: number;
        degreesTarget: number;
        isSubgraph: boolean;
        sort: { by: 'date' | 'relevance'; direction: 'asc' | 'desc' };
        pagination: { pageSize: number; cursor?: string };
        edgesPagination?: { pageSize: number; cursor?: string };
    } = {
        queryBuilder: serializeQueryBuilder(group),
        degreesSource: query.degreesSource ?? 0,
        degreesTarget: query.degreesTarget ?? 0,
        isSubgraph: query.isSubgraph ?? false,
        sort: {
            by: sortBy,
            direction: query.sortDirection || 'desc'
        },
        pagination: {
            pageSize,
            cursor: cursor || undefined
        }
    };

    if ((query.degreesSource ?? 0) > 0 || (query.degreesTarget ?? 0) > 0) {
        payload.edgesPagination = {
            pageSize: DEFAULT_EDGE_PAGE_SIZE,
            cursor: edgesCursor || undefined
        };
    }

    return payload;
}

export async function fetchCombinedPage(
    query: SearchQuery,
    group: QueryBuilderGroup,
    pageSize = DEFAULT_PAGE_SIZE,
    cursor?: string,
    signal?: AbortSignal
): Promise<PageResult> {
    const body = buildCombinedPayload(query, group, pageSize, cursor);

    const response = await fetch(`${API_BASE}/api/combined`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Combined API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`Combined API: ${data.error}`);
    }
    const result = data as CombinedResponse;
    const nodes = (result.nodes || [])
        .filter((n: CombinedNode) => n.data.isResult === 'True' || n.data.isResult === true) as CombinedNode[];

    const citations = nodes.map((node) => {
        const dataset = String(node.data.dataset || '').toUpperCase();
        const citation = dataset === 'ECHR'
            ? transformEchrNode(node)
            : transformNetworkNode(node);
        const relevanceScore = typeof node.data.relevanceScore === 'number' ? node.data.relevanceScore : undefined;
        return relevanceScore !== undefined ? { ...citation, relevanceScore } : citation;
    });

    const total =
        (typeof (result as { total?: unknown }).total === 'number' ? (result as { total: number }).total : undefined) ??
        (typeof (result.pagination as { total?: unknown } | undefined)?.total === 'number'
            ? (result.pagination as { total: number }).total
            : undefined) ??
        (typeof (result.pagination as { totalCount?: unknown } | undefined)?.totalCount === 'number'
            ? (result.pagination as { totalCount: number }).totalCount
            : undefined);

    const totalIsExact =
        (typeof (result as { totalIsExact?: unknown }).totalIsExact === 'boolean'
            ? (result as { totalIsExact: boolean }).totalIsExact
            : undefined) ??
        (typeof (result.pagination as { totalIsExact?: unknown } | undefined)?.totalIsExact === 'boolean'
            ? (result.pagination as { totalIsExact: boolean }).totalIsExact
            : undefined) ??
        (total !== undefined ? true : undefined);

    const edges: ApiEdge[] = Array.isArray(result.edges) ? [...result.edges] : [];
    let edgesPagination = result.edgesPagination;

    if (edgesPagination?.nextCursor) {
        let edgeCursor = edgesPagination.nextCursor;
        const seen = new Set<string>(edges.map((edge) => edge.id));
        while (edgeCursor) {
            const edgePayload = buildCombinedPayload(query, group, pageSize, cursor, edgeCursor);
            const edgeResponse = await fetch(`${API_BASE}/api/combined`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(edgePayload),
                signal
            });
            if (!edgeResponse.ok) {
                const errorText = await edgeResponse.text();
                throw new Error(`Combined API error (${edgeResponse.status}): ${errorText}`);
            }
            const edgeData = (await edgeResponse.json()) as CombinedResponse;
            if (edgeData.error) {
                throw new Error(`Combined API: ${edgeData.error}`);
            }
            const nextEdges = Array.isArray(edgeData.edges) ? edgeData.edges : [];
            for (const edge of nextEdges) {
                if (edge.id && seen.has(edge.id)) continue;
                if (edge.id) seen.add(edge.id);
                edges.push(edge);
            }
            edgeCursor = edgeData.edgesPagination?.nextCursor;
            edgesPagination = edgeData.edgesPagination || edgesPagination;
        }
    }

    return {
        citations,
        nextCursor: result.pagination?.nextCursor,
        total,
        totalIsExact,
        edges,
        edgesPagination
    };
}

export { DEFAULT_PAGE_SIZE };
