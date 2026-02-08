import type { SourceScope } from '~/lib/types';

export type QueryBuilderField = { value: string; label: string };
export type QueryBuilderOperator = { value: string; label: string };

export const QUERY_BUILDER_FIELDS_COMMON: QueryBuilderField[] = [
    { value: 'text', label: 'Full Text' },
    { value: 'title', label: 'Title' },
    { value: 'ecli', label: 'ECLI' },
    { value: 'keywords', label: 'Keywords' },
    { value: 'year', label: 'Year' },
    { value: 'dateStart', label: 'Date Start' },
    { value: 'dateEnd', label: 'Date End' },
    { value: 'source', label: 'Data Source' }
];

export const QUERY_BUILDER_FIELDS_ECHR: QueryBuilderField[] = [
    { value: 'article_violated', label: 'Article Violated' },
    { value: 'article_applied', label: 'Article Applied' },
    { value: 'article_non_violated', label: 'Article Non-Violated' },
    { value: 'respondent_state', label: 'Respondent State' },
    { value: 'application_number', label: 'Application Number' },
    { value: 'document_type', label: 'Document Type' },
    { value: 'importance', label: 'Importance' },
    { value: 'language', label: 'Language' },
    { value: 'date_judgment_start', label: 'Judgment Date Start' },
    { value: 'date_judgment_end', label: 'Judgment Date End' },
    { value: 'date_decision_start', label: 'Decision Date Start' },
    { value: 'date_decision_end', label: 'Decision Date End' }
];

export const QUERY_BUILDER_FIELDS_RS: QueryBuilderField[] = [
    { value: 'document_type', label: 'Document Type' },
    { value: 'instance', label: 'Court Instance' },
    { value: 'domain', label: 'Legal Domain' },
    { value: 'articles', label: 'Articles' },
    { value: 'selectedLaws', label: 'Selected Laws' }
];

export const QUERY_BUILDER_FIELDS_BY_SCOPE: Record<SourceScope, QueryBuilderField[]> = {
    ANY: QUERY_BUILDER_FIELDS_COMMON,
    ECHR: [...QUERY_BUILDER_FIELDS_COMMON, ...QUERY_BUILDER_FIELDS_ECHR],
    RS: [...QUERY_BUILDER_FIELDS_COMMON, ...QUERY_BUILDER_FIELDS_RS]
};

const ECHR_ONLY_FIELDS = new Set(QUERY_BUILDER_FIELDS_ECHR.map((f) => f.value));
const RS_ONLY_FIELDS = new Set(QUERY_BUILDER_FIELDS_RS.map((f) => f.value));

export const QUERY_BUILDER_OPERATORS: Record<string, QueryBuilderOperator[]> = {
    text: [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' }
    ],
    title: [
        { value: 'contains', label: 'contains' },
        { value: 'equals', label: 'equals' },
        { value: 'not_contains', label: 'does not contain' }
    ],
    ecli: [
        { value: 'contains', label: 'contains' },
        { value: 'equals', label: 'equals' },
        { value: 'not_contains', label: 'does not contain' }
    ],
    article_violated: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'includes' },
        { value: 'not_contains', label: 'does not include' }
    ],
    article_applied: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'includes' },
        { value: 'not_contains', label: 'does not include' }
    ],
    article_non_violated: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'includes' },
        { value: 'not_contains', label: 'does not include' }
    ],
    respondent_state: [
        { value: 'equals', label: 'is' },
        { value: 'not_equals', label: 'is not' }
    ],
    keywords: [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' }
    ],
    dateStart: [
        { value: 'equals', label: 'equals' },
        { value: 'after', label: 'after' }
    ],
    dateEnd: [
        { value: 'equals', label: 'equals' },
        { value: 'before', label: 'before' }
    ],
    year: [
        { value: 'equals', label: 'equals' },
        { value: 'after', label: 'after' },
        { value: 'before', label: 'before' }
    ],
    document_type: [{ value: 'equals', label: 'is' }],
    instance: [{ value: 'equals', label: 'is' }],
    domain: [{ value: 'equals', label: 'is' }],
    articles: [
        { value: 'contains', label: 'contains' },
        { value: 'equals', label: 'equals' },
        { value: 'not_contains', label: 'does not contain' }
    ],
    selectedLaws: [
        { value: 'equals', label: 'equals' },
        { value: 'contains', label: 'contains' }
    ],
    importance: [
        { value: 'equals', label: 'is' },
        { value: 'lte', label: 'at most' }
    ],
    language: [
        { value: 'equals', label: 'is' },
        { value: 'not_equals', label: 'is not' }
    ],
    date_judgment_start: [
        { value: 'equals', label: 'equals' },
        { value: 'after', label: 'after' }
    ],
    date_judgment_end: [
        { value: 'equals', label: 'equals' },
        { value: 'before', label: 'before' }
    ],
    date_decision_start: [
        { value: 'equals', label: 'equals' },
        { value: 'after', label: 'after' }
    ],
    date_decision_end: [
        { value: 'equals', label: 'equals' },
        { value: 'before', label: 'before' }
    ],
    source: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'contains' },
        { value: 'not_equals', label: 'is not' }
    ],
    application_number: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'contains' }
    ]
};

export function isFieldAllowed(scope: SourceScope, field: string): boolean {
    return QUERY_BUILDER_FIELDS_BY_SCOPE[scope].some((f) => f.value === field);
}

export function defaultFieldForScope(scope: SourceScope): string {
    return QUERY_BUILDER_FIELDS_BY_SCOPE[scope][0]?.value ?? 'text';
}

export function defaultScopeForField(field: string): SourceScope {
    if (ECHR_ONLY_FIELDS.has(field)) return 'ECHR';
    if (RS_ONLY_FIELDS.has(field)) return 'RS';
    return 'ANY';
}
