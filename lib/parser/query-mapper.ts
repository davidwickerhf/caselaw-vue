import type { ParsedToken, SearchQuery } from '~/lib/types';
import { DataSource, createDefaultSearchQuery } from '~/lib/types';

/**
 * Convert confirmed tokens + remaining text into a SearchQuery.
 */
export function tokensToSearchQuery(
    tokens: ParsedToken[],
    remainingText: string
): SearchQuery {
    const query = createDefaultSearchQuery();

    const violated: string[] = [];
    const applied: string[] = [];
    const nonViolated: string[] = [];
    const states: string[] = [];
    const applicationNumbers: string[] = [];
    const docTypesEchr: string[] = [];
    const importanceLevels: number[] = [];
    const instances: string[] = [];
    const domains: string[] = [];
    const sources: DataSource[] = [];
    const keywords: string[] = [];
    const eclis: string[] = [];

    for (const token of tokens) {
        switch (token.type) {
            case 'article_violated':
                violated.push(token.value);
                break;
            case 'article_applied':
                applied.push(token.value);
                break;
            case 'article_non_violated':
                nonViolated.push(token.value);
                break;
            case 'respondent_state':
                states.push(token.value);
                break;
            case 'application_number':
                applicationNumbers.push(token.value);
                break;
            case 'year':
                query.dateStart = `${token.value}-01-01`;
                query.dateEnd = `${token.value}-12-31`;
                break;
            case 'date_start':
                query.dateStart = token.value;
                break;
            case 'date_end':
                query.dateEnd = token.value;
                break;
            case 'document_type':
                docTypesEchr.push(token.value);
                break;
            case 'importance':
                importanceLevels.push(parseInt(token.value));
                break;
            case 'instance':
                instances.push(token.value);
                break;
            case 'domain':
                domains.push(token.value);
                break;
            case 'source':
                if (token.value === 'ECHR') sources.push(DataSource.ECHR);
                else if (token.value === 'RS') sources.push(DataSource.RS);
                break;
            case 'keyword':
                keywords.push(token.value);
                break;
            case 'ecli':
                eclis.push(token.value);
                break;
        }
    }

    query.text = remainingText;
    if (keywords.length) query.keywords = keywords;
    if (eclis.length) query.eclis = eclis;
    if (sources.length) query.sources = sources;
    if (violated.length) query.scoped.echr.articleViolated = violated;
    if (applied.length) query.scoped.echr.articleApplied = applied;
    if (nonViolated.length) query.scoped.echr.articleNonViolated = nonViolated;
    if (states.length) query.scoped.echr.respondentState = states;
    if (applicationNumbers.length) query.scoped.echr.applicationNumbers = applicationNumbers;
    if (docTypesEchr.length) query.scoped.echr.documentType = docTypesEchr;
    if (importanceLevels.length) query.scoped.echr.importance = importanceLevels;
    if (instances.length) query.scoped.rs.instances = instances;
    if (domains.length) query.scoped.rs.domains = domains;
    // If no source token, keep default (both sources)

    return query;
}
