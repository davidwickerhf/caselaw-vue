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

export type QuerySummarySegment =
    | { type: 'text'; text: string }
    | { type: 'value'; text: string; ruleId: string }
    | { type: 'scope'; text: string; ruleId: string };

function ruleToSegments(rule: { id: string; field: string; operator: string; value: string; sourceScope: SourceScope }): QuerySummarySegment[] {
    if (!rule.value.trim()) return [];
    const scopeLabel = SCOPE_LABELS[rule.sourceScope || 'ANY'] || 'Any';
    const fieldLabel = QUERY_BUILDER_FIELDS_BY_SCOPE[rule.sourceScope || 'ANY']?.find((f) => f.value === rule.field)?.label || rule.field;
    const opLabel = QUERY_BUILDER_OPERATORS[rule.field]?.find((o) => o.value === rule.operator)?.label || rule.operator;
    return [
        { type: 'scope', text: scopeLabel, ruleId: rule.id },
        { type: 'text', text: `: ${fieldLabel} ${opLabel} "` },
        { type: 'value', text: rule.value, ruleId: rule.id },
        { type: 'text', text: '"' }
    ];
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

function groupToSegments(group: QueryBuilderGroup): QuerySummarySegment[] {
    const parts: QuerySummarySegment[][] = [];
    for (const rule of group.rules) {
        const segs = ruleToSegments(rule);
        if (segs.length) parts.push(segs);
    }
    for (const sub of group.groups) {
        const subSegs = groupToSegments(sub);
        if (subSegs.length) {
            parts.push([{ type: 'text', text: '(' }, ...subSegs, { type: 'text', text: ')' }]);
        }
    }

    if (parts.length === 0) return [];
    if (parts.length === 1) return parts[0];

    const joined: QuerySummarySegment[] = [];
    parts.forEach((part, idx) => {
        if (idx > 0) joined.push({ type: 'text', text: ` ${group.operator} ` });
        joined.push(...part);
    });
    return joined;
}

export function summarizeQueryBuilder(group: QueryBuilderGroup, maxLength = 160): string {
    const text = groupToText(group);
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}

export function buildQuerySummarySegments(group: QueryBuilderGroup): QuerySummarySegment[] {
    return groupToSegments(group);
}
