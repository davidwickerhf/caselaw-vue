import type { SearchQuery, EchrSearchFilters, RsSearchFilters } from '~/lib/types';
import { createDefaultSearchQuery } from '~/lib/types';

function mergeText(commonText: string, scopedText: string): string {
    const parts = [commonText, scopedText].map((t) => t.trim()).filter(Boolean);
    return parts.join(' ').trim();
}

function mergeList(common: string[], scoped: string[]): string[] {
    const combined = [...common, ...scoped].map((v) => v.trim()).filter(Boolean);
    return Array.from(new Set(combined));
}

function mergeNumberList(common: number[], scoped: number[]): number[] {
    const combined = [...common, ...scoped].filter((v) => Number.isFinite(v));
    return Array.from(new Set(combined));
}

function mergeDateStart(commonStart?: string, scopedStart?: string): string | undefined {
    if (commonStart && scopedStart) return commonStart > scopedStart ? commonStart : scopedStart;
    return scopedStart || commonStart;
}

function mergeDateEnd(commonEnd?: string, scopedEnd?: string): string | undefined {
    if (commonEnd && scopedEnd) return commonEnd < scopedEnd ? commonEnd : scopedEnd;
    return scopedEnd || commonEnd;
}

export function buildEffectiveEchrFilters(query: SearchQuery): EchrSearchFilters {
    const scoped = query.scoped ?? createDefaultSearchQuery().scoped;
    return {
        text: mergeText(query.text, scoped.echr.text),
        keywords: mergeList(query.keywords, scoped.echr.keywords),
        eclis: mergeList(query.eclis, scoped.echr.eclis),
        dateStart: mergeDateStart(query.dateStart, scoped.echr.dateStart),
        dateEnd: mergeDateEnd(query.dateEnd, scoped.echr.dateEnd),
        articleViolated: mergeList(query.articleViolated, scoped.echr.articleViolated),
        articleApplied: mergeList(query.articleApplied, scoped.echr.articleApplied),
        articleNonViolated: mergeList(query.articleNonViolated, scoped.echr.articleNonViolated),
        respondentState: mergeList(query.respondentState, scoped.echr.respondentState),
        documentType: mergeList(query.documentType, scoped.echr.documentType),
        importance: mergeNumberList(query.importance, scoped.echr.importance)
    };
}

export function buildEffectiveRsFilters(query: SearchQuery): RsSearchFilters {
    const scoped = query.scoped ?? createDefaultSearchQuery().scoped;
    return {
        text: mergeText(query.text, scoped.rs.text),
        keywords: mergeList(query.keywords, scoped.rs.keywords),
        eclis: mergeList(query.eclis, scoped.rs.eclis),
        dateStart: mergeDateStart(query.dateStart, scoped.rs.dateStart),
        dateEnd: mergeDateEnd(query.dateEnd, scoped.rs.dateEnd),
        documentType: mergeList(query.documentType, scoped.rs.documentType),
        instances: mergeList(query.instances, scoped.rs.instances),
        domains: mergeList(query.domains, scoped.rs.domains)
    };
}

export function hasCommonFilters(query: SearchQuery): boolean {
    return !!(query.text.trim() || query.keywords.length || query.eclis.length || query.dateStart || query.dateEnd);
}
