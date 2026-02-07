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
            if (value === 'DEC' || value === 'OPI') return 'RS';
            if (value.startsWith('HE')) return 'ECHR';
            return 'ANY';
        }
        case 'instance':
        case 'domain':
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
        year: { field: 'year', operator: 'equals' },
        date_start: { field: 'year', operator: 'after' },
        date_end: { field: 'year', operator: 'before' },
        document_type: { field: 'document_type', operator: 'equals' },
        importance: { field: 'importance', operator: 'equals' },
        instance: { field: 'instance', operator: 'equals' },
        domain: { field: 'domain', operator: 'equals' },
        source: { field: 'source', operator: 'equals' },
        ecli: { field: 'ecli', operator: 'equals' },
        keyword: { field: 'keywords', operator: 'contains' },
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
