import type { QueryBuilderGroup, SourceScope } from '~/lib/types';
import { QUERY_BUILDER_FIELDS_BY_SCOPE, QUERY_BUILDER_OPERATORS } from '~/lib/utils/query-builder-config';

const SCOPE_LABELS: Record<SourceScope, string> = {
    ANY: 'Any',
    ECHR: 'ECHR',
    RS: 'Rechtspraak'
};

function ruleToText(rule: { field: string; operator: string; value: string; sourceScope: SourceScope }): string {
    if (!rule.value.trim()) return '';
    const scopeLabel = SCOPE_LABELS[rule.sourceScope || 'ANY'] || 'Any';
    const fieldLabel = QUERY_BUILDER_FIELDS_BY_SCOPE[rule.sourceScope || 'ANY']?.find((f) => f.value === rule.field)?.label || rule.field;
    const opLabel = QUERY_BUILDER_OPERATORS[rule.field]?.find((o) => o.value === rule.operator)?.label || rule.operator;
    return `${scopeLabel}: ${fieldLabel} ${opLabel} "${rule.value}"`;
}

function groupToText(group: QueryBuilderGroup): string {
    const parts: string[] = [];
    for (const rule of group.rules) {
        const text = ruleToText(rule);
        if (text) parts.push(text);
    }
    for (const sub of group.groups) {
        const subText = groupToText(sub);
        if (subText) parts.push(`(${subText})`);
    }
    return parts.join(` ${group.operator} `);
}

export function summarizeQueryBuilder(group: QueryBuilderGroup, maxLength = 160): string {
    const text = groupToText(group);
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}
