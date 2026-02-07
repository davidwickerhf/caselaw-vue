import type { Citation, SearchQuery, ApiNetworkResponse, ApiNode } from '~/lib/types';
import { DataSource } from '~/lib/types';
import { normalizeRespondentStates, respondentCodeToName } from '~/lib/utils/respondent-state';
import { buildEffectiveEchrFilters, buildEffectiveRsFilters } from '~/lib/utils/search-scope';

const API_BASE = 'http://localhost:3000';

const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGES = 20; // Safety limit to prevent infinite loops

/**
 * Build the request body for the ECHR API endpoint.
 */
function buildEchrBody(query: SearchQuery, pageSize: number, cursor?: string): Record<string, unknown> {
    const effective = buildEffectiveEchrFilters(query);
    const args: Record<string, unknown> = {
        degreesSource: 0,
        degreesTarget: 0,
        attributesToFetch: 'ALL',
        onlyCaseIds: false,
        isSubgraph: false,
        pageSize
    };

    if (cursor) {
        args.cursor = cursor;
    }

    // Keywords: combine free-text and structured keywords
    const allKeywords = [
        ...(effective.text.trim() ? [effective.text.trim()] : []),
        ...effective.keywords
    ];
    if (allKeywords.length > 0) {
        args.keywords = allKeywords;
    }

    // ECLI search
    if (effective.eclis.length > 0) {
        args.ecli = effective.eclis;
    }

    // Article filters
    if (effective.articleViolated.length > 0) {
        args.article_violated = effective.articleViolated;
        args.article_violated_mode = 'OR';
    }
    if (effective.articleApplied.length > 0) {
        args.article_applied = effective.articleApplied;
        args.article_applied_mode = 'OR';
    }
    if (effective.articleNonViolated.length > 0) {
        args.article_non_violated = effective.articleNonViolated;
        args.article_non_violated_mode = 'OR';
    }

    // Respondent state
    if (effective.respondentState.length > 0) {
        args.respondent_state = normalizeRespondentStates(effective.respondentState);
    }

    // Document type
    if (effective.documentType.length > 0) {
        args.document_type = effective.documentType;
    }

    // Importance
    if (effective.importance.length > 0) {
        args.importance = effective.importance;
    }

    // Date range
    if (effective.dateStart) {
        args.date_judgment_start = effective.dateStart;
    }
    if (effective.dateEnd) {
        args.date_judgment_end = effective.dateEnd;
    }

    return { arguments: args };
}

/**
 * Build the request body for the Network (Rechtspraak) API endpoint.
 */
function buildNetworkBody(query: SearchQuery, pageSize: number, cursor?: string): Record<string, unknown> {
    const effective = buildEffectiveRsFilters(query);
    const args: Record<string, unknown> = {
        dataSources: ['RS'],
        engine: 'ES',
        degreesSource: 0,
        degreesTarget: 0,
        attributesToFetch: 'ALL',
        onlyCaseIds: false,
        isSubgraph: false,
        docTypes: ['DEC', 'OPI'],  // Required by the API
        pageSize
    };

    if (cursor) {
        args.cursor = cursor;
    }

    // Keywords: combine free-text and structured keywords
    const allKeywords = [
        ...(effective.text.trim() ? [effective.text.trim()] : []),
        ...effective.keywords
    ];
    if (allKeywords.length > 0) {
        args.keywords = allKeywords;
    }

    // ECLI search
    if (effective.eclis.length > 0) {
        args.eclis = effective.eclis;
    }

    // Date range
    if (effective.dateStart) {
        args.dateStart = effective.dateStart;
    }
    if (effective.dateEnd) {
        args.dateEnd = effective.dateEnd;
    }

    // Document types - only override default if valid RS types are selected
    const rsDocTypes = effective.documentType.filter((dt) => dt === 'DEC' || dt === 'OPI');
    if (rsDocTypes.length > 0) {
        args.docTypes = rsDocTypes;
    }

    // Instances
    if (effective.instances.length > 0) {
        args.instances = effective.instances;
    }

    // Domains
    if (effective.domains.length > 0) {
        args.domains = effective.domains;
    }

    return { arguments: args };
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
};

/**
 * Fetch a single page from the ECHR API.
 */
export async function fetchEchrPage(query: SearchQuery, pageSize = DEFAULT_PAGE_SIZE, cursor?: string): Promise<PageResult> {
    const body = buildEchrBody(query, pageSize, cursor);
    const response = await fetch(`${API_BASE}/api/echr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ECHR API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`ECHR API: ${data.error}`);
    }
    const result = data as ApiNetworkResponse;
    const nodes = (result.nodes || [])
        .filter((n) => n.data.isResult === 'True' || n.data.isResult === true);

    return {
        citations: nodes.map(transformEchrNode),
        nextCursor: result.pagination?.nextCursor
    };
}

/**
 * Fetch a single page from the Network (Rechtspraak) API.
 */
export async function fetchNetworkPage(query: SearchQuery, pageSize = DEFAULT_PAGE_SIZE, cursor?: string): Promise<PageResult> {
    const body = buildNetworkBody(query, pageSize, cursor);
    const response = await fetch(`${API_BASE}/api/network`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Network API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`Network API: ${data.error}`);
    }
    const result = data as ApiNetworkResponse;
    const nodes = (result.nodes || [])
        .filter((n) => n.data.isResult === 'True' || n.data.isResult === true);

    return {
        citations: nodes.map(transformNetworkNode),
        nextCursor: result.pagination?.nextCursor
    };
}

/**
 * Determine which sources should be searched based on the query.
 */
export function getSearchableSources(query: SearchQuery): { echr: boolean; rs: boolean } {
    const searchECHR = query.sources.length === 0 || query.sources.includes(DataSource.ECHR);
    const searchRS = query.sources.length === 0 || query.sources.includes(DataSource.RS);

    const echrFilters = buildEffectiveEchrFilters(query);
    const rsFilters = buildEffectiveRsFilters(query);

    const echrHasTextOrKeywords = echrFilters.text.trim().length > 0 || echrFilters.keywords.length > 0;
    const rsHasTextOrKeywords = rsFilters.text.trim().length > 0 || rsFilters.keywords.length > 0;
    const echrHasEclis = echrFilters.eclis.length > 0;
    const rsHasEclis = rsFilters.eclis.length > 0;
    const echrHasArticles = echrFilters.articleViolated.length > 0 || echrFilters.articleApplied.length > 0 ||
        echrFilters.articleNonViolated.length > 0;
    const rsHasFilters = rsFilters.instances.length > 0 || rsFilters.domains.length > 0 || rsFilters.documentType.length > 0;
    const echrHasDate = !!echrFilters.dateStart || !!echrFilters.dateEnd;
    const rsHasDate = !!rsFilters.dateStart || !!rsFilters.dateEnd;

    const echrCanSearch = searchECHR && (echrHasEclis || echrHasTextOrKeywords || echrHasArticles || echrHasDate);
    const rsCanSearch = searchRS && (rsHasTextOrKeywords || rsHasEclis || rsHasFilters || rsHasDate);

    return { echr: echrCanSearch, rs: rsCanSearch };
}

export { DEFAULT_PAGE_SIZE, MAX_PAGES };
