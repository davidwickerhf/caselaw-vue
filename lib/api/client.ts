import type { Citation, SearchQuery, ApiNode, QueryBuilderGroup, ApiEdge, SourceScope, ExpandResult } from '~/lib/types';
import { respondentCodeToName, respondentStateToCode } from '~/lib/utils/respondent-state';
import { defaultScopeForField, isFieldAllowed } from '~/lib/utils/query-builder-config';
import { RECHTSPRAAK_DOMAIN_ALIASES, RECHTSPRAAK_DOMAINS } from '~/lib/utils/constants';

const API_BASE = 'http://localhost:3000';

const DEFAULT_PAGE_SIZE = 50;

type CombinedNode = ApiNode & { data: Record<string, unknown> & { dataset?: string; isResult?: string | boolean } };
type CombinedResponse = {
    nodes: ApiNode[];
    pagination?: {
        pageSize: number;
        nextCursor?: string | null;
        total: number;
        rsTotal: number;
        echrTotal: number;
    };
    facets?: Record<string, Array<{ value: string | number; count: number }>>;
    warnings?: string[];
    message?: string;
};

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
        nCited: typeof d.cited_by_count === 'number' ? d.cited_by_count : citedBy.length,
        nCiting: typeof d.cites_count === 'number' ? d.cites_count : cites.length,
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
        nCited: typeof d.cited_by_count === 'number' ? d.cited_by_count : citedBy.length,
        nCiting: typeof d.cites_count === 'number' ? d.cites_count : cites.length,
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
    rsTotal?: number;
    echrTotal?: number;
    facets?: Record<string, Array<{ value: string | number; count: number }>>;
};

/**
 * Fetch a single page from the ECHR API.
 */
export function buildCombinedPayload(
    query: SearchQuery,
    group: QueryBuilderGroup,
    pageSize = DEFAULT_PAGE_SIZE,
    cursor?: string,
) {
    const sortBy = query.sortBy === 'citations' ? 'citations' : 'date';
    return {
        queryBuilder: serializeQueryBuilder(group),
        sort: {
            by: sortBy,
            direction: query.sortDirection || 'desc'
        },
        pagination: {
            pageSize,
            cursor: cursor || undefined
        }
    };
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
        return citation;
    });

    const total = result.pagination?.total ??
        (typeof (result as unknown as { total?: unknown }).total === 'number' ? (result as unknown as { total: number }).total : undefined);

    return {
        citations,
        nextCursor: result.pagination?.nextCursor ?? undefined,
        total,
        totalIsExact: total !== undefined ? true : undefined,
        rsTotal: result.pagination?.rsTotal,
        echrTotal: result.pagination?.echrTotal,
        facets: result.facets,
    };
}

/**
 * Expand a single node's degree-1 citations via the expand endpoint.
 */
export async function fetchExpandNode(
    nodeId: string,
    options?: { degreesSource?: 0 | 1; degreesTarget?: 0 | 1; nodeDataset?: 'ECHR' | 'RS' },
    signal?: AbortSignal
): Promise<ExpandResult> {
    const body: Record<string, unknown> = { nodeId };
    if (options?.degreesSource) body.degreesSource = options.degreesSource;
    if (options?.degreesTarget) body.degreesTarget = options.degreesTarget;
    if (options?.nodeDataset) body.nodeDataset = options.nodeDataset;

    const response = await fetch(`${API_BASE}/api/combined/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Expand API error (${response.status}): ${errorText}`);
    }

    return await response.json();
}

/**
 * Language entry returned by the ECHR full-text endpoint when no language is specified.
 */
export type EchrLanguageEntry = {
    itemid: string;
    full_text: string | null;
    full_text_available: boolean;
    message?: string;
};

/**
 * Result of fetching full text for a single document.
 *
 * For ECHR (no language param): returns a `languages` map so the UI can
 * switch languages client-side without re-fetching.
 * For Rechtspraak (or ECHR with a specific language): returns a single `fullText`.
 */
export type FullTextResult = {
    fullText: string | null;
    /** Active language code (e.g. "ENG") */
    language?: string;
    /** All available languages keyed by ISO code (ECHR only, when fetched without language param) */
    languages?: Record<string, EchrLanguageEntry>;
    /** Default/preferred language returned by the backend */
    defaultLanguage?: string;
    error?: string;
};

/**
 * Fetch the full text for a document (POST-only endpoints).
 *
 * ECHR:        POST /api/echr/text    { ecli }  → languages map (all languages)
 * Rechtspraak: POST /api/network/text { ecli }  → { ecli, full_text }
 *
 * For ECHR we omit the language param so the backend returns all available
 * languages in one response. The component can then switch locally.
 * Returns 404 when the ECLI is not found.
 */
export async function fetchDocumentFullText(
    ecli: string,
    source: 'HUDOC' | 'Rechtspraak',
    options?: { signal?: AbortSignal }
): Promise<FullTextResult> {
    const signal = options?.signal;
    const endpoint = source === 'HUDOC'
        ? `${API_BASE}/api/echr/text`
        : `${API_BASE}/api/network/text`;

    try {
        const body: Record<string, unknown> = { ecli };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });

        if (!response.ok) {
            if (response.status === 404) return { fullText: null };
            const errorText = await response.text().catch(() => '');
            return { fullText: null, error: `Full-text API error (${response.status}): ${errorText}`.trim() };
        }

        const data = await response.json();
        const record = Array.isArray(data) ? data[0] : data;
        if (!record) return { fullText: null };

        // ECHR without language → { ecli, default_language, languages: { ENG: {...}, FRE: {...} } }
        if (record.languages && typeof record.languages === 'object') {
            const defaultLang: string = record.default_language || 'ENG';
            const languages = record.languages as Record<string, EchrLanguageEntry>;

            // Pick the default language's text
            const defaultEntry = languages[defaultLang];
            const fullText = defaultEntry?.full_text_available && typeof defaultEntry.full_text === 'string'
                ? defaultEntry.full_text
                : null;

            return { fullText, language: defaultLang, defaultLanguage: defaultLang, languages };
        }

        // Rechtspraak or single-language response → { ecli, full_text }
        const fullText = typeof record.full_text === 'string' && record.full_text.trim()
            ? record.full_text
            : null;

        return { fullText, language: record.language };
    } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        return { fullText: null, error: err instanceof Error ? err.message : 'Failed to fetch full text' };
    }
}

export { DEFAULT_PAGE_SIZE };
