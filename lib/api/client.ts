import type { Citation, CitationSource, SearchQuery, ApiNode, QueryBuilderGroup, ApiEdge, SourceScope, ExpandResult } from '~/lib/types';
import { DataSource, createDefaultSearchQuery } from '~/lib/types';
import { respondentCodeToName, respondentStateToCode } from '~/lib/utils/respondent-state';
import { defaultScopeForField, isFieldAllowed } from '~/lib/utils/query-builder-config';
import { RECHTSPRAAK_DOMAIN_ALIASES, RECHTSPRAAK_DOMAINS } from '~/lib/utils/constants';
import { datasetFromEcli, type Dataset } from '~/lib/utils/sources';
import {
    sanitizeText as sanitizeTextInput,
    sanitizeFilterValue,
    sanitizeCursor,
    sanitizeEcli,
    isValidEcli,
    clampPageSize,
    MAX_TEXT_LENGTH,
    MAX_PAGE_SIZE,
    MAX_RULES,
    MAX_GROUPS,
    MAX_RULES_PER_GROUP,
} from '~/lib/utils/query-sanitize';
/**
 * API base path — empty string means same-origin.  All /api/** requests are
 * proxied through Nitro (configured in nuxt.config.ts) to the actual backend,
 * which eliminates CORS in both dev and production.
 */
const API_BASE = '';

const DEFAULT_PAGE_SIZE = 50;

function apiUrl(path: string) {
    if (typeof window === 'undefined') return `${API_BASE}${path}`;
    return new URL(`${API_BASE}${path}`, window.location.origin).toString();
}

async function fetchJsonResponse(path: string, init: RequestInit) {
    const url = apiUrl(path);
    try {
        return await fetch(url, init);
    } catch (err) {
        const message = err instanceof Error && err.message
            ? err.message
            : String(err);
        throw new Error(`Request failed for ${url}: ${message}`);
    }
}

type CombinedNode = ApiNode & { data: Record<string, unknown> & { dataset?: string; isResult?: string | boolean } };
type CombinedResponse = {
    nodes: ApiNode[];
    pagination?: {
        pageSize: number;
        nextCursor?: string | null;
        total: number;
        rsTotal: number;
        echrTotal: number;
        cjeuTotal?: number;
    };
    facets?: Record<string, Array<{ value: string | number; count: number }>>;
    warnings?: string[];
    message?: string;
};

const RS_DOC_TYPES = new Set(['DEC', 'OPI']);
const ECHR_DOC_TYPES = new Set(['JUD', 'DEC', 'COM', 'CLIN', 'PR', 'OTHER']);
const CJEU_DOC_TYPES = new Set(['judgment', 'opinion', 'order', 'ruling', 'decision', 'other']);
const CJEU_COURTS = new Set(['CJEU', 'EGC', 'CST']);
const CJEU_SECTORS = new Set(['6', '8']);
const DOCUMENT_TYPE_ALIASES = new Set(['echr_document_type', 'rs_document_type', 'cjeu_document_type']);
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
    if (upper === 'CJEU' || upper === 'CURIA' || upper === 'EU' || upper === 'EURLEX') return 'CJEU';
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
    // ISO 639-1 ("en", the stored form) or a legacy HUDOC code ("ENG").
    const trimmed = value.trim();
    if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toLowerCase();
    if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
    return null;
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
    // CJEU document types are lowercase words (judgment, opinion, …).
    const lower = upper.toLowerCase();
    if (scope === 'CJEU') return CJEU_DOC_TYPES.has(lower) ? { value: lower, scope } : null;
    if (scope === 'ANY' && CJEU_DOC_TYPES.has(lower) && !RS_DOC_TYPES.has(upper) && !ECHR_DOC_TYPES.has(upper)) {
        return { value: lower, scope: 'CJEU' };
    }
    // DEC is shared between RS and ECHR — keep as-is and let scope determine
    if (upper === 'DEC') {
        if (scope === 'RS' || scope === 'ECHR') return { value: upper, scope };
        return { value: upper, scope: 'ANY' };
    }
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
            const code = respondentStateToCode(sanitizeFilterValue(trimmed));
            if (!code) return null;
            return { value: code, scope };
        }
        case 'domain': {
            const normalized = normalizeDomainValue(sanitizeFilterValue(trimmed));
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
            return normalizeDocumentType(sanitizeFilterValue(trimmed), scope);
        }
        case 'echr_document_type': {
            return normalizeDocumentType(sanitizeFilterValue(trimmed), 'ECHR');
        }
        case 'rs_document_type': {
            return normalizeDocumentType(sanitizeFilterValue(trimmed), 'RS');
        }
        case 'cjeu_document_type': {
            return normalizeDocumentType(sanitizeFilterValue(trimmed), 'CJEU');
        }
        case 'court': {
            const court = sanitizeFilterValue(trimmed).toUpperCase();
            return CJEU_COURTS.has(court) ? { value: court, scope } : null;
        }
        case 'sector': {
            const sector = sanitizeFilterValue(trimmed);
            return CJEU_SECTORS.has(sector) ? { value: sector, scope } : null;
        }
        case 'formation': {
            const formation = sanitizeFilterValue(trimmed).toUpperCase();
            return formation ? { value: formation, scope } : null;
        }
        case 'eu_law': {
            const celex = sanitizeFilterValue(trimmed).toUpperCase();
            return /^[0-9A-Z()%]+$/.test(celex) ? { value: celex, scope } : null;
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
        case 'ecli': {
            // Validate ECLI format before sending to the API
            const clean = sanitizeEcli(trimmed);
            if (!clean) return null;
            return { value: clean, scope };
        }
        case 'text':
        case 'title':
        case 'keywords': {
            // Free-text fields: sanitise for script injection, cap length
            const clean = sanitizeTextInput(trimmed);
            if (!clean) return null;
            return { value: clean, scope };
        }
        case 'instance':
        case 'articles':
        case 'application_number': {
            // Short filter values
            const clean = sanitizeFilterValue(trimmed);
            if (!clean) return null;
            return { value: clean, scope };
        }
        default:
            // Fallback: sanitise as filter value
            return { value: sanitizeFilterValue(trimmed), scope };
    }
}

function serializeRule(r: { field: string; operator: string; value: string; sourceScope?: SourceScope }) {
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

    // The per-corpus document type fields are UI aliases; the API knows one
    // `document_type` field, told apart by sourceScope.
    const apiField = DOCUMENT_TYPE_ALIASES.has(field) ? 'document_type' : field;
    return [{ field: apiField, operator, value: normalized.value, sourceScope: normalized.scope }];
}

function serializeQueryBuilder(group: QueryBuilderGroup) {
    // Cap rules at the root level
    const rules = group.rules
        .slice(0, MAX_RULES)
        .flatMap(serializeRule);

    // Cap nested groups and rules per group
    const groups = group.groups
        .slice(0, MAX_GROUPS)
        .map((g) => ({
            op: g.operator,
            rules: g.rules
                .slice(0, MAX_RULES_PER_GROUP)
                .flatMap(serializeRule)
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
        languages: Array.isArray(d.languages) ? d.languages as string[] : [],
        originating_body: (d.originating_body as string) || undefined,
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
        languages: Array.isArray(d.languages) ? d.languages as string[] : ['NLD'],
        legal_provisions: (d.legal_provisions as string[]) || undefined,
        predecessor_successor_cases: d.predecessor_successor_cases as string | undefined,
        ecli_decision: d.ecli_decision as string | undefined,
        ecli_opinion: d.ecli_opinion as string | undefined,
        cites,
        cited_by: citedBy
    };
}

/**
 * Transform a CJEU API node into our Citation type.
 */
function transformCjeuNode(node: ApiNode): Citation {
    const d = node.data;
    const ecli = (d.ecli as string) || node.id;
    const dateDecision = d.date_decision as string | undefined;
    const dateStr = dateDecision ? dateDecision.split('T')[0] : '';
    const year = dateStr ? new Date(dateStr).getFullYear() : 0;
    const cites = (d.cites as string[]) || [];
    const citedBy = (d.cited_by as string[]) || [];
    const strList = (v: unknown) => Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
    const caseNumber = (d.case_number as string) || undefined;
    const title = (d.title as string) || (caseNumber ? `Case ${caseNumber}` : undefined);
    const subjects = strList(d.subjects);

    return {
        id: ecli,
        ecli,
        year,
        date: dateStr || undefined,
        date_decision: dateStr || undefined,
        summary: (d.summary as string) || '',
        instance: (d.formation as string) || '',
        domain: subjects?.[0] || '',
        domains: subjects || [],
        nCited: typeof d.cited_by_count === 'number' ? d.cited_by_count : citedBy.length,
        nCiting: typeof d.cites_count === 'number' ? d.cites_count : cites.length,
        topics: '',
        document_type: (d.document_type as string) || '',
        procedure_type: (d.procedure_type as string) || '',
        url_publication: (d.url_publication as string)
            || (d.celex ? `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${d.celex}` : ''),
        source: 'CJEU',
        languages: strList(d.languages) || [],
        importance: typeof d.importance === 'number' ? d.importance : undefined,
        title,
        celex: (d.celex as string) || undefined,
        case_number: caseNumber,
        court: (d.court as string) || undefined,
        formation: (d.formation as string) || undefined,
        sector: (d.sector as string) || undefined,
        advocate_general: (d.advocate_general as string) || undefined,
        date_lodged: typeof d.date_lodged === 'string' ? d.date_lodged.split('T')[0] : undefined,
        subjects,
        countries: strList(d.countries),
        parties: strList(d.parties),
        judge_rapporteur: (d.judge_rapporteur as string) || undefined,
        eu_law: Array.isArray(d.eu_law) ? d.eu_law as Array<{ celex: string; title: string | null }> : undefined,
        cites,
        cited_by: citedBy
    };
}

/**
 * Pick the transform for a node by its dataset, falling back to its ECLI.
 */
export function transformApiNode(node: ApiNode): Citation {
    const raw = String(node.data.dataset || '').toUpperCase();
    const dataset: Dataset | null = raw === 'ECHR' || raw === 'RS' || raw === 'CJEU'
        ? raw
        : datasetFromEcli((node.data.ecli as string) || node.id);
    if (dataset === 'ECHR') return transformEchrNode(node);
    if (dataset === 'CJEU') return transformCjeuNode(node);
    return transformNetworkNode(node);
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
    cjeuTotal?: number;
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
    const sortDir = query.sortDirection === 'asc' ? 'asc' : 'desc';
    return {
        queryBuilder: serializeQueryBuilder(group),
        sort: {
            by: sortBy,
            direction: sortDir,
        },
        pagination: {
            pageSize: clampPageSize(pageSize),
            cursor: sanitizeCursor(cursor),
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

    const response = await fetchJsonResponse('/api/combined', {
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

    const citations = nodes.map((node) => transformApiNode(node));

    const total = result.pagination?.total ??
        (typeof (result as unknown as { total?: unknown }).total === 'number' ? (result as unknown as { total: number }).total : undefined);

    return {
        citations,
        nextCursor: result.pagination?.nextCursor ?? undefined,
        total,
        totalIsExact: total !== undefined ? true : undefined,
        rsTotal: result.pagination?.rsTotal,
        echrTotal: result.pagination?.echrTotal,
        cjeuTotal: result.pagination?.cjeuTotal,
        facets: result.facets,
    };
}

/**
 * Expand a single node's degree-1 citations via the expand endpoint.
 */
export async function fetchExpandNode(
    nodeId: string,
    options?: { degreesSource?: 0 | 1; degreesTarget?: 0 | 1; nodeDataset?: Dataset },
    signal?: AbortSignal
): Promise<ExpandResult> {
    // Validate nodeId (should be a valid ECLI)
    const cleanNodeId = sanitizeEcli(nodeId);
    if (!cleanNodeId) {
        throw new Error('Invalid node ID (ECLI) for expand request.');
    }

    const body: Record<string, unknown> = { nodeId: cleanNodeId };

    // Validate degrees (must be 0 or 1)
    if (options?.degreesSource !== undefined) {
        body.degreesSource = options.degreesSource === 1 ? 1 : 0;
    }
    if (options?.degreesTarget !== undefined) {
        body.degreesTarget = options.degreesTarget === 1 ? 1 : 0;
    }
    // Validate dataset (allowlist)
    if (options?.nodeDataset) {
        const ds = options.nodeDataset.toUpperCase();
        if (ds === 'ECHR' || ds === 'RS' || ds === 'CJEU') body.nodeDataset = ds;
    }

    const response = await fetchJsonResponse('/api/combined/expand', {
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
 * CJEU metadata the combined search doesn't carry (subjects, referring
 * country, parties, judge-rapporteur, Advocate General, EU law cited), from
 * POST /api/cjeu with every attribute. Best effort: null on any failure.
 */
export async function fetchCjeuMetadata(ecli: string, signal?: AbortSignal): Promise<Partial<Citation> | null> {
    const cleanEcli = sanitizeEcli(ecli);
    if (!cleanEcli) return null;
    try {
        const response = await fetchJsonResponse('/api/cjeu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                arguments: {
                    eclis: [cleanEcli],
                    attributesToFetch: 'ALL',
                    degreesSource: 0,
                    degreesTarget: 0,
                    citationLists: false,
                },
            }),
            signal,
        });
        if (!response.ok) return null;
        const data = await response.json();
        const node = (data.nodes as ApiNode[] | undefined)?.find((n) => n.id === cleanEcli);
        if (!node) return null;
        const full = transformCjeuNode({ ...node, data: { ...node.data, cites: undefined, cited_by: undefined } });
        return {
            subjects: full.subjects,
            countries: full.countries,
            parties: full.parties,
            judge_rapporteur: full.judge_rapporteur,
            advocate_general: full.advocate_general,
            eu_law: full.eu_law,
            formation: full.formation,
            date_lodged: full.date_lodged,
        };
    } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        return null;
    }
}

/**
 * Detect the data source from an ECLI string.
 */
export function detectSourceFromEcli(ecli: string): Dataset | null {
    return datasetFromEcli(ecli);
}

/**
 * Fetch a single document by ECLI.
 *
 * Uses the combined search endpoint (ECLI equals query) for the document's own
 * metadata, and the expand endpoint for citation relationships.  The two
 * requests are fired in parallel to reduce latency.
 */
export async function fetchDocumentByEcli(
    ecli: string,
    signal?: AbortSignal
): Promise<{
    citation: Citation | null;
    citedDocs: Citation[];
    citesEclis: Set<string>;
    citedByEclis: Set<string>;
    error?: string;
}> {
    // Validate & sanitise the ECLI before any network call
    const cleanEcli = sanitizeEcli(ecli);
    if (!cleanEcli) {
        return { citation: null, citedDocs: [], citesEclis: new Set(), citedByEclis: new Set(), error: 'Invalid ECLI format' };
    }

    const dataset = detectSourceFromEcli(cleanEcli);
    if (!dataset) {
        return { citation: null, citedDocs: [], citesEclis: new Set(), citedByEclis: new Set(), error: 'Unknown ECLI format' };
    }

    // Build a minimal combined-search query that matches this exact ECLI
    const ecliQuery: SearchQuery = {
        ...createDefaultSearchQuery(),
        sources: [dataset === 'ECHR' ? DataSource.ECHR : dataset === 'CJEU' ? DataSource.CJEU : DataSource.RS],
        pageSize: 1,
        page: 1,
    };
    const ecliGroup: QueryBuilderGroup = {
        id: 'ecli-group',
        operator: 'AND',
        rules: [{ id: 'ecli-rule', field: 'ecli', operator: 'equals', value: cleanEcli, sourceScope: dataset as SourceScope }],
        groups: [],
    };

    try {
        // Fire both requests in parallel
        const [searchResult, expandResult, cjeuMetadata] = await Promise.all([
            fetchCombinedPage(ecliQuery, ecliGroup, 1, undefined, signal),
            fetchExpandNode(cleanEcli, {
                degreesSource: 1,
                degreesTarget: 1,
                nodeDataset: dataset,
            }, signal).catch(() => null), // expand may fail for docs with no citations – that's ok
            dataset === 'CJEU' ? fetchCjeuMetadata(cleanEcli, signal) : Promise.resolve(null),
        ]);

        // Document from search, with the CJEU metadata the combined search leaves out
        const found = searchResult.citations.length > 0 ? searchResult.citations[0] : null;
        const citation = found && cjeuMetadata
            ? {
                ...found,
                ...Object.fromEntries(Object.entries(cjeuMetadata).filter(([, v]) => v !== undefined)),
                domains: cjeuMetadata.subjects?.length ? cjeuMetadata.subjects : found.domains,
                domain: cjeuMetadata.subjects?.[0] || found.domain,
            } as Citation
            : found;

        // Citation network from expand
        const citesSet = new Set<string>();
        const citedBySet = new Set<string>();
        let citedDocs: Citation[] = [];

        if (expandResult) {
            for (const edge of expandResult.edges) {
                if (edge.source === cleanEcli) citesSet.add(edge.target);
                if (edge.target === cleanEcli) citedBySet.add(edge.source);
            }

            citedDocs = expandResult.expandedNodes
                .filter((node) => {
                    const nodeEcli = (node.data.ecli as string) || node.id;
                    return nodeEcli !== cleanEcli; // exclude the document itself if present
                })
                .map((node) => transformApiNode(node));
        }

        return { citation, citedDocs, citesEclis: citesSet, citedByEclis: citedBySet };
    } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        return {
            citation: null,
            citedDocs: [],
            citesEclis: new Set(),
            citedByEclis: new Set(),
            error: err instanceof Error ? err.message : 'Failed to fetch document'
        };
    }
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
 * The API sends booleans as the strings "True"/"False" in some responses.
 */
function normalizeLanguageEntries(raw: Record<string, Record<string, unknown>>): Record<string, EchrLanguageEntry> {
    const out: Record<string, EchrLanguageEntry> = {};
    for (const [lang, entry] of Object.entries(raw || {})) {
        if (!entry || typeof entry !== 'object') continue;
        const flag = entry.full_text_available;
        const text = typeof entry.full_text === 'string' && entry.full_text.trim() ? entry.full_text : null;
        const available = flag === true || String(flag).toLowerCase() === 'true' || (flag === undefined && !!text);
        out[lang] = {
            itemid: typeof entry.itemid === 'string' ? entry.itemid : '',
            full_text: text,
            full_text_available: available && !!text,
            message: typeof entry.message === 'string' ? entry.message : undefined,
        };
    }
    return out;
}

/**
 * Fetch the full text for a document (POST-only endpoints).
 *
 * ECHR:        POST /api/echr/text        { ecli }  → languages map (all languages)
 * CJEU:        POST /api/cjeu/text        { ecli }  → languages map (official EU languages)
 * Rechtspraak: POST /api/rechtspraak/text { ecli }  → { ecli, full_text }
 *
 * For ECHR we omit the language param so the backend returns all available
 * languages in one response. The component can then switch locally.
 * Returns 404 when the ECLI is not found.
 */
export async function fetchDocumentFullText(
    ecli: string,
    source: CitationSource,
    options?: { signal?: AbortSignal }
): Promise<FullTextResult> {
    // Validate ECLI before sending to the API
    const cleanEcli = sanitizeEcli(ecli);
    if (!cleanEcli) {
        return { fullText: null, error: 'Invalid ECLI format' };
    }

    const signal = options?.signal;

    try {
        const body: Record<string, unknown> = { ecli: cleanEcli };

        const path = source === 'HUDOC'
            ? '/api/echr/text'
            : source === 'CJEU'
                ? '/api/cjeu/text'
                : '/api/rechtspraak/text';
        const response = await fetchJsonResponse(path, {
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
            const languages = normalizeLanguageEntries(record.languages as Record<string, Record<string, unknown>>);
            const available = Object.keys(languages).filter((lang) => languages[lang].full_text_available);
            const requested: string = record.default_language || 'en';
            const defaultLang = languages[requested]?.full_text_available
                ? requested
                : (available.find((l) => l.toLowerCase() === 'en') || available[0] || requested);

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
