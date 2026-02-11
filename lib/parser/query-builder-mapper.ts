import type { ParsedToken, QueryBuilderGroup, QueryBuilderRule, SourceScope } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export function tokenScope(token: ParsedToken): SourceScope {
    switch (token.type) {
        case 'article_violated':
        case 'article_applied':
        case 'article_non_violated':
        case 'respondent_state':
        case 'application_number':
        case 'importance':
        case 'document_type': {
            const value = String(token.value || '').toUpperCase();
            if (value === 'OPI') return 'RS';
            // DEC is shared between RS and ECHR — keep as ANY
            if (value === 'DEC') return 'ANY';
            // ECHR-only codes
            const ECHR_ONLY_TYPES = new Set(['JUD', 'COM', 'CLIN', 'PR', 'OTHER']);
            if (ECHR_ONLY_TYPES.has(value)) return 'ECHR';
            return 'ANY';
        }
        case 'language':
        case 'date_judgment_start':
        case 'date_judgment_end':
        case 'date_judgment_exact':
        case 'date_decision_start':
        case 'date_decision_end':
        case 'date_decision_exact':
            return 'ECHR';
        case 'instance':
        case 'domain':
        case 'articles':
        case 'selected_laws':
            return 'RS';
        default:
            return 'ANY';
    }
}

/**
 * Map a ParsedToken to a QueryBuilderRule.
 */
export function tokenToRule(token: ParsedToken): QueryBuilderRule | null {
    const fieldMap: Record<string, { field: string; operator: string }> = {
        article_violated: { field: 'article_violated', operator: 'equals' },
        article_applied: { field: 'article_applied', operator: 'equals' },
        article_non_violated: { field: 'article_non_violated', operator: 'equals' },
        respondent_state: { field: 'respondent_state', operator: 'equals' },
        application_number: { field: 'application_number', operator: 'equals' },
        language: { field: 'language', operator: 'equals' },
        year: { field: 'year', operator: 'equals' },
        date_start: { field: 'year', operator: 'after' },
        date_end: { field: 'year', operator: 'before' },
        date_start_exact: { field: 'dateStart', operator: 'equals' },
        date_end_exact: { field: 'dateEnd', operator: 'equals' },
        date_judgment_start: { field: 'date_judgment_start', operator: 'after' },
        date_judgment_end: { field: 'date_judgment_end', operator: 'before' },
        date_judgment_exact: { field: 'date_judgment_start', operator: 'equals' },
        date_decision_start: { field: 'date_decision_start', operator: 'after' },
        date_decision_end: { field: 'date_decision_end', operator: 'before' },
        date_decision_exact: { field: 'date_decision_start', operator: 'equals' },
        document_type: { field: 'document_type', operator: 'equals' },
        importance: { field: 'importance', operator: 'equals' },
        instance: { field: 'instance', operator: 'equals' },
        domain: { field: 'domain', operator: 'equals' },
        articles: { field: 'articles', operator: 'contains' },
        selected_laws: { field: 'selectedLaws', operator: 'equals' },
        title: { field: 'title', operator: 'contains' },
        source: { field: 'source', operator: 'equals' },
        ecli: { field: 'ecli', operator: 'equals' },
        keyword: { field: 'text', operator: 'contains' },
    };

    const mapping = fieldMap[token.type];
    if (!mapping) return null;

    const value = token.value;
    if (mapping.field === 'year' && (token.type === 'date_start' || token.type === 'date_end')) {
        const year = value.slice(0, 4);
        return {
            id: token.id,
            field: mapping.field,
            operator: mapping.operator,
            value: year,
            sourceScope: tokenScope(token),
        };
    }

    return {
        id: token.id,
        field: mapping.field,
        operator: mapping.operator,
        value,
        sourceScope: tokenScope(token),
    };
}

/**
 * Convert confirmed tokens + remaining text into a QueryBuilderGroup.
 */
export function tokensToQueryBuilderGroup(
    tokens: ParsedToken[],
    remainingText: string
): QueryBuilderGroup {
    const rules: QueryBuilderRule[] = [];

    for (const token of tokens) {
        const rule = tokenToRule(token);
        if (rule) rules.push(rule);
    }

    // Add remaining text as a "text contains" rule
    if (remainingText.trim()) {
        rules.push({
            id: genId(),
            field: 'text',
            operator: 'contains',
            value: remainingText.trim(),
            sourceScope: 'ANY',
        });
    }

    // Ensure at least one rule
    if (rules.length === 0) {
        rules.push({
            id: genId(),
            field: 'text',
            operator: 'contains',
            value: '',
            sourceScope: 'ANY',
        });
    }

    return {
        id: genId(),
        operator: 'AND',
        rules,
        groups: [],
    };
}
