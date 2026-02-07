import type { SourceScope } from '~/lib/types';

export type QueryBuilderField = { value: string; label: string };
export type QueryBuilderOperator = { value: string; label: string };

export const QUERY_BUILDER_FIELDS_COMMON: QueryBuilderField[] = [
    { value: 'text', label: 'Full Text' },
    { value: 'title', label: 'Title' },
    { value: 'ecli', label: 'ECLI' },
    { value: 'keywords', label: 'Keywords' },
    { value: 'year', label: 'Year' },
    { value: 'source', label: 'Data Source' }
];

export const QUERY_BUILDER_FIELDS_ECHR: QueryBuilderField[] = [
    { value: 'article_violated', label: 'Article Violated' },
    { value: 'article_applied', label: 'Article Applied' },
    { value: 'article_non_violated', label: 'Article Non-Violated' },
    { value: 'respondent_state', label: 'Respondent State' },
    { value: 'document_type', label: 'Document Type' },
    { value: 'importance', label: 'Importance' }
];

export const QUERY_BUILDER_FIELDS_RS: QueryBuilderField[] = [
    { value: 'document_type', label: 'Document Type' },
    { value: 'instance', label: 'Court Instance' },
    { value: 'domain', label: 'Legal Domain' }
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
        { value: 'equals', label: 'equals' }
    ],
    ecli: [
        { value: 'contains', label: 'contains' },
        { value: 'equals', label: 'equals' }
    ],
    article_violated: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'includes' }
    ],
    article_applied: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'includes' }
    ],
    article_non_violated: [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'includes' }
    ],
    respondent_state: [
        { value: 'equals', label: 'is' },
        { value: 'not_equals', label: 'is not' }
    ],
    keywords: [{ value: 'contains', label: 'contains' }],
    year: [
        { value: 'equals', label: 'equals' },
        { value: 'after', label: 'after' },
        { value: 'before', label: 'before' }
    ],
    document_type: [{ value: 'equals', label: 'is' }],
    instance: [{ value: 'equals', label: 'is' }],
    domain: [{ value: 'equals', label: 'is' }],
    importance: [
        { value: 'equals', label: 'is' },
        { value: 'lte', label: 'at most' }
    ],
    source: [{ value: 'equals', label: 'is' }]
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
