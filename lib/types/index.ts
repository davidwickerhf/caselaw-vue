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
    title: string[];
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
    applicationNumbers: string[];
    documentType: string[];
    importance: number[];
    language: string[];
    dateJudgmentStart?: string;
    dateJudgmentEnd?: string;
    dateDecisionStart?: string;
    dateDecisionEnd?: string;
};

export type RsSearchFilters = CommonSearchFilters & {
    documentType: string[];
    instances: string[];
    domains: string[];
    articles: string[];
    selectedLaws: string[];
};

export type ScopedSearchFilters = {
    echr: EchrSearchFilters;
    rs: RsSearchFilters;
};

export type SearchQuery = {
    text: string;
    title: string[];
    sources: DataSource[];
    keywords: string[];
    eclis: string[];
    cursor?: string;
    dateStart?: string;
    dateEnd?: string;
    articleViolated: string[];
    articleApplied: string[];
    articleNonViolated: string[];
    respondentState: string[];
    applicationNumbers: string[];
    documentType: string[];
    importance: number[];
    language: string[];
    instances: string[];
    domains: string[];
    articles: string[];
    selectedLaws: string[];
    dateJudgmentStart?: string;
    dateJudgmentEnd?: string;
    dateDecisionStart?: string;
    dateDecisionEnd?: string;
    sortBy: 'relevance' | 'date' | 'citations' | 'importance';
    sortDirection: 'asc' | 'desc';
    page: number;
    pageSize: number;
    degreesSource: number;
    degreesTarget: number;
    isSubgraph: boolean;
    scoped: ScopedSearchFilters;
    queryBuilderGroup?: QueryBuilderGroup;
};

export type SearchResult = {
    results: Citation[];
    total: number;
    totalIsExact: boolean;
    page: number;
    pageSize: number;
    facets: SearchFacets;
    nextCursor?: string;
    loadingMore?: boolean;
    aiSummary?: string;
    relatedSearches?: string[];
    didYouMean?: string;
    edges?: ApiEdge[];
    edgesPagination?: ApiEdgesPagination;
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
    | 'application_number'
    | 'language'
    | 'year'
    | 'date_start'
    | 'date_end'
    | 'date_start_exact'
    | 'date_end_exact'
    | 'date_judgment_start'
    | 'date_judgment_end'
    | 'date_judgment_exact'
    | 'date_decision_start'
    | 'date_decision_end'
    | 'date_decision_exact'
    | 'degree_source'
    | 'degree_target'
    | 'degree_depth'
    | 'subgraph'
    | 'document_type'
    | 'importance'
    | 'instance'
    | 'domain'
    | 'articles'
    | 'selected_laws'
    | 'title'
    | 'source'
    | 'ecli'
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

export type ApiEdgesPagination = {
    pageSize: number;
    nextCursor?: string;
    total?: number;
};

export type ApiNetworkResponse = {
    nodes: ApiNode[];
    edges: ApiEdge[];
    message?: string;
    pagination?: ApiPagination;
    edgesPagination?: ApiEdgesPagination;
};

export function createDefaultSearchQuery(): SearchQuery {
    return {
        text: '',
        title: [],
        sources: [DataSource.ECHR, DataSource.RS],
        keywords: [],
        eclis: [],
        cursor: undefined,
        articleViolated: [],
        articleApplied: [],
        articleNonViolated: [],
        respondentState: [],
        applicationNumbers: [],
        documentType: [],
        importance: [],
        language: [],
        instances: [],
        domains: [],
        articles: [],
        selectedLaws: [],
        dateJudgmentStart: undefined,
        dateJudgmentEnd: undefined,
        dateDecisionStart: undefined,
        dateDecisionEnd: undefined,
        sortBy: 'relevance',
        sortDirection: 'desc',
        page: 1,
        pageSize: 100,
        degreesSource: 0,
        degreesTarget: 0,
        isSubgraph: false,
        scoped: {
            echr: {
                text: '',
                title: [],
                keywords: [],
                eclis: [],
                articleViolated: [],
                articleApplied: [],
                articleNonViolated: [],
                respondentState: [],
                applicationNumbers: [],
                documentType: [],
                importance: [],
                language: [],
                dateJudgmentStart: undefined,
                dateJudgmentEnd: undefined,
                dateDecisionStart: undefined,
                dateDecisionEnd: undefined
            },
            rs: {
                text: '',
                title: [],
                keywords: [],
                eclis: [],
                documentType: [],
                instances: [],
                domains: [],
                articles: [],
                selectedLaws: []
            }
        }
    };
}
