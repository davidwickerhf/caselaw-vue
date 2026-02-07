export type Citation = {
    id: string;
    ecli: string;
    year: number;
    date?: string;
    summary: string;
    instance: string;
    domain: string;
    domains: string[];
    nCited: number;
    nCiting: number;
    topics: string;
    document_type: string;
    procedure_type: string;
    url_publication: string;
    source: 'HUDOC' | 'Rechtspraak';
    relevanceScore?: number;
    // ECHR-specific fields
    itemid?: string;
    language?: string;
    date_judgment?: string;
    date_decision?: string;
    respondent_state?: string;
    application_number?: string;
    languages?: Record<string, string>;
    article_violated?: string[];
    article_applied?: string[];
    article_non_violated?: string[];
    importance?: number;
    conclusion?: string;
    keywords?: string[];
    title?: string;
    headnote?: string;
    // Rechtspraak-specific
    legal_provisions?: string[];
    predecessor_successor_cases?: string;
    ecli_decision?: string;
    ecli_opinion?: string;
    // Citation arrays from API
    cites?: string[];
    cited_by?: string[];
};

export enum DataSource {
    RS = 'RS',
    ECHR = 'ECHR'
}

export enum DocType {
    OPI = 'OPI',
    DEC = 'DEC'
}

export type SourceScope = 'ANY' | 'ECHR' | 'RS';

export type CommonSearchFilters = {
    text: string;
    keywords: string[];
    eclis: string[];
    dateStart?: string;
    dateEnd?: string;
};

export type EchrSearchFilters = CommonSearchFilters & {
    articleViolated: string[];
    articleApplied: string[];
    articleNonViolated: string[];
    respondentState: string[];
    documentType: string[];
    importance: number[];
};

export type RsSearchFilters = CommonSearchFilters & {
    documentType: string[];
    instances: string[];
    domains: string[];
};

export type ScopedSearchFilters = {
    echr: EchrSearchFilters;
    rs: RsSearchFilters;
};

export type SearchQuery = {
    text: string;
    sources: DataSource[];
    keywords: string[];
    eclis: string[];
    echrCursor?: string;
    rsCursor?: string;
    dateStart?: string;
    dateEnd?: string;
    articleViolated: string[];
    articleApplied: string[];
    articleNonViolated: string[];
    respondentState: string[];
    documentType: string[];
    importance: number[];
    instances: string[];
    domains: string[];
    sortBy: 'relevance' | 'date' | 'citations' | 'importance';
    sortDirection: 'asc' | 'desc';
    page: number;
    pageSize: number;
    scoped: ScopedSearchFilters;
};

export type SearchResult = {
    results: Citation[];
    total: number;
    page: number;
    pageSize: number;
    facets: SearchFacets;
    loadingMore?: boolean;
    aiSummary?: string;
    relatedSearches?: string[];
    didYouMean?: string;
};

export type SearchFacets = {
    sources: FacetItem[];
    years: FacetItem[];
    articles: FacetItem[];
    respondentStates: FacetItem[];
    documentTypes: FacetItem[];
    importance: FacetItem[];
    instances: FacetItem[];
    domains: FacetItem[];
};

export type FacetItem = {
    value: string;
    count: number;
};

export type QueryBuilderGroup = {
    id: string;
    operator: 'AND' | 'OR' | 'NOT';
    rules: QueryBuilderRule[];
    groups: QueryBuilderGroup[];
};

export type QueryBuilderRule = {
    id: string;
    field: string;
    operator: string;
    value: string;
    sourceScope: SourceScope;
};

export type SearchSuggestion = {
    text: string;
    type: 'recent' | 'suggested' | 'ecli';
    description?: string;
};

// Smart search parser types
export type ParsedTokenType =
    | 'article_violated'
    | 'article_applied'
    | 'article_non_violated'
    | 'respondent_state'
    | 'year'
    | 'date_start'
    | 'date_end'
    | 'document_type'
    | 'importance'
    | 'instance'
    | 'domain'
    | 'source'
    | 'keyword';

export type ParsedToken = {
    id: string;
    type: ParsedTokenType;
    value: string;
    display: string;
};

export type ParseSuggestion = {
    id: string;
    trigger: string;
    triggerStart: number;
    triggerEnd: number;
    token: ParsedToken;
    tokens?: ParsedToken[];
    preview: string;
};

export type ParseResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    remainingText: string;
};

// Raw API response types
export type ApiNode = {
    id: string;
    data: Record<string, unknown>;
};

export type ApiEdge = {
    id: string;
    source: string;
    target: string;
};

export type ApiPagination = {
    pageSize: number;
    nextCursor?: string;
};

export type ApiNetworkResponse = {
    nodes: ApiNode[];
    edges: ApiEdge[];
    message?: string;
    pagination?: ApiPagination;
};

export function createDefaultSearchQuery(): SearchQuery {
    return {
        text: '',
        sources: [DataSource.ECHR, DataSource.RS],
        keywords: [],
        eclis: [],
        echrCursor: undefined,
        rsCursor: undefined,
        articleViolated: [],
        articleApplied: [],
        articleNonViolated: [],
        respondentState: [],
        documentType: [],
        importance: [],
        instances: [],
        domains: [],
        sortBy: 'relevance',
        sortDirection: 'desc',
        page: 1,
        pageSize: 20,
        scoped: {
            echr: {
                text: '',
                keywords: [],
                eclis: [],
                articleViolated: [],
                articleApplied: [],
                articleNonViolated: [],
                respondentState: [],
                documentType: [],
                importance: []
            },
            rs: {
                text: '',
                keywords: [],
                eclis: [],
                documentType: [],
                instances: [],
                domains: []
            }
        }
    };
}
