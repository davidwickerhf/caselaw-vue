import { createDefaultSearchQuery, DataSource, type ParsedToken, type QueryBuilderGroup, type QueryBuilderRule, type SearchQuery, type CommonSearchFilters, type SourceScope } from '~/lib/types';
import { IMPORTANCE_LEVELS } from '~/lib/utils/constants';
import { defaultScopeForField, isFieldAllowed } from '~/lib/utils/query-builder-config';

function genId(): string {
	return Math.random().toString(36).slice(2, 10);
}

function articleDisplay(kind: 'violated' | 'non-violated' | 'applied', num: string): string {
	return `Art. ${num} · ${kind}`;
}

export function searchQueryToTokens(query: SearchQuery): ParsedToken[] {
	const tokens: ParsedToken[] = [];
	const scoped = query.scoped ?? createDefaultSearchQuery().scoped;
	const defaults = createDefaultSearchQuery();
	const seen = new Set<string>();

	const addToken = (token: ParsedToken) => {
		const key = `${token.type}:${token.value}`;
		if (seen.has(key)) return;
		seen.add(key);
		tokens.push(token);
	};

	const addDateTokens = (start?: string, end?: string) => {
		if (!start && !end) return;
		if (start && end) {
			const startYear = start.slice(0, 4);
			const endYear = end.slice(0, 4);
			if (start.endsWith('-01-01') && end.endsWith('-12-31') && startYear === endYear) {
				addToken({ id: genId(), type: 'year', value: startYear, display: startYear });
			} else {
				addToken({ id: genId(), type: 'date_start', value: start, display: `From ${startYear}` });
				addToken({ id: genId(), type: 'date_end', value: end, display: `To ${endYear}` });
			}
		} else if (start) {
			const year = start.slice(0, 4);
			addToken({ id: genId(), type: 'date_start', value: start, display: `From ${year}` });
		} else if (end) {
			const year = end.slice(0, 4);
			addToken({ id: genId(), type: 'date_end', value: end, display: `To ${year}` });
		}
	};

	const addArticles = (values: string[], type: ParsedToken['type'], label: 'violated' | 'applied' | 'non-violated') => {
		for (const num of values) {
			addToken({ id: genId(), type, value: num, display: articleDisplay(label, num) });
		}
	};

	addArticles(query.articleViolated, 'article_violated', 'violated');
	addArticles(query.articleApplied, 'article_applied', 'applied');
	addArticles(query.articleNonViolated, 'article_non_violated', 'non-violated');
	addArticles(scoped.echr.articleViolated, 'article_violated', 'violated');
	addArticles(scoped.echr.articleApplied, 'article_applied', 'applied');
	addArticles(scoped.echr.articleNonViolated, 'article_non_violated', 'non-violated');

	for (const state of [...query.respondentState, ...scoped.echr.respondentState]) {
		addToken({ id: genId(), type: 'respondent_state', value: state, display: state });
	}
	for (const keyword of [...query.keywords, ...scoped.echr.keywords, ...scoped.rs.keywords]) {
		addToken({ id: genId(), type: 'keyword', value: keyword, display: keyword });
	}

	addDateTokens(query.dateStart, query.dateEnd);
	addDateTokens(scoped.echr.dateStart, scoped.echr.dateEnd);
	addDateTokens(scoped.rs.dateStart, scoped.rs.dateEnd);

	for (const doc of [...query.documentType, ...scoped.echr.documentType, ...scoped.rs.documentType]) {
		addToken({ id: genId(), type: 'document_type', value: doc, display: doc });
	}
	for (const imp of [...query.importance, ...scoped.echr.importance]) {
		const label = IMPORTANCE_LEVELS.find((i) => i.value === imp)?.label || String(imp);
		addToken({ id: genId(), type: 'importance', value: String(imp), display: label });
	}
	for (const inst of [...query.instances, ...scoped.rs.instances]) {
		addToken({ id: genId(), type: 'instance', value: inst, display: inst });
	}
	for (const dom of [...query.domains, ...scoped.rs.domains]) {
		addToken({ id: genId(), type: 'domain', value: dom, display: dom });
	}
	if (query.sources.join(',') !== defaults.sources.join(',')) {
		for (const src of query.sources) {
			addToken({
				id: genId(),
				type: 'source',
				value: src,
				display: src === DataSource.ECHR ? 'ECHR' : 'Rechtspraak',
			});
		}
	}

	return tokens;
}

export function searchQueryToQueryBuilderGroup(query: SearchQuery): QueryBuilderGroup {
	const rules: QueryBuilderRule[] = [];
	const defaults = createDefaultSearchQuery();
	const scoped = query.scoped ?? defaults.scoped;

	const pushRule = (field: string, operator: string, value: string, scope: SourceScope) => {
		if (!value) return;
		rules.push({ id: genId(), field, operator, value, sourceScope: scope });
	};

	const addText = (text: string, scope: SourceScope) => {
		const normalized = normalizeText(text || '');
		if (normalized) pushRule('text', 'contains', normalized, scope);
	};

	const addDateRules = (start: string | undefined, end: string | undefined, scope: SourceScope) => {
		if (!start && !end) return;
		if (start && end) {
			const startYear = start.slice(0, 4);
			const endYear = end.slice(0, 4);
			if (start.endsWith('-01-01') && end.endsWith('-12-31') && startYear === endYear) {
				pushRule('year', 'equals', startYear, scope);
				return;
			}
		}
		if (start) pushRule('year', 'after', start.slice(0, 4), scope);
		if (end) pushRule('year', 'before', end.slice(0, 4), scope);
	};

	addText(query.text, 'ANY');
	for (const value of query.keywords) pushRule('keywords', 'contains', value, 'ANY');
	for (const value of query.eclis) pushRule('ecli', 'equals', value, 'ANY');
	addDateRules(query.dateStart, query.dateEnd, 'ANY');
	for (const value of query.articleViolated) pushRule('article_violated', 'equals', value, 'ANY');
	for (const value of query.articleApplied) pushRule('article_applied', 'equals', value, 'ANY');
	for (const value of query.articleNonViolated) pushRule('article_non_violated', 'equals', value, 'ANY');
	for (const value of query.respondentState) pushRule('respondent_state', 'equals', value, 'ANY');
	for (const value of query.documentType) pushRule('document_type', 'equals', value, 'ANY');
	for (const value of query.importance) pushRule('importance', 'equals', String(value), 'ANY');
	for (const value of query.instances) pushRule('instance', 'equals', value, 'ANY');
	for (const value of query.domains) pushRule('domain', 'equals', value, 'ANY');
	if (query.sources.join(',') !== defaults.sources.join(',')) {
		for (const src of query.sources) {
			pushRule('source', 'equals', src, 'ANY');
		}
	}

	addText(scoped.echr.text, 'ECHR');
	for (const value of scoped.echr.keywords) pushRule('keywords', 'contains', value, 'ECHR');
	for (const value of scoped.echr.eclis) pushRule('ecli', 'equals', value, 'ECHR');
	addDateRules(scoped.echr.dateStart, scoped.echr.dateEnd, 'ECHR');
	for (const value of scoped.echr.articleViolated) pushRule('article_violated', 'equals', value, 'ECHR');
	for (const value of scoped.echr.articleApplied) pushRule('article_applied', 'equals', value, 'ECHR');
	for (const value of scoped.echr.articleNonViolated) pushRule('article_non_violated', 'equals', value, 'ECHR');
	for (const value of scoped.echr.respondentState) pushRule('respondent_state', 'equals', value, 'ECHR');
	for (const value of scoped.echr.documentType) pushRule('document_type', 'equals', value, 'ECHR');
	for (const value of scoped.echr.importance) pushRule('importance', 'equals', String(value), 'ECHR');

	addText(scoped.rs.text, 'RS');
	for (const value of scoped.rs.keywords) pushRule('keywords', 'contains', value, 'RS');
	for (const value of scoped.rs.eclis) pushRule('ecli', 'equals', value, 'RS');
	addDateRules(scoped.rs.dateStart, scoped.rs.dateEnd, 'RS');
	for (const value of scoped.rs.documentType) pushRule('document_type', 'equals', value, 'RS');
	for (const value of scoped.rs.instances) pushRule('instance', 'equals', value, 'RS');
	for (const value of scoped.rs.domains) pushRule('domain', 'equals', value, 'RS');

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

function normalizeText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function addTextQuery(query: CommonSearchFilters, value: string) {
	const next = normalizeText(value);
	if (!next) return;
	query.text = query.text ? `${query.text} ${next}` : next;
}

function parseYear(value: string): number | null {
	const num = Number(value);
	if (!Number.isInteger(num) || num < 1900 || num > 2100) return null;
	return num;
}

function ensureSingleDepth(group: QueryBuilderGroup): string | null {
	for (const sub of group.groups) {
		if (sub.groups.length > 0) return 'Nested groups are not supported in URL mode.';
	}
	return null;
}

function flattenGroupRules(group: QueryBuilderGroup): QueryBuilderRule[] {
	const rules = [...group.rules];
	for (const sub of group.groups) {
		rules.push(...sub.rules);
	}
	return rules;
}

export function queryBuilderGroupToSearchQuery(group: QueryBuilderGroup): { query?: SearchQuery; error?: string } {
	const invalid = ensureSingleDepth(group);
	if (invalid) return { error: invalid };

	const query = createDefaultSearchQuery();
	const importanceAny = new Set<number>();
	const importanceEchr = new Set<number>();
	const sourceSet = new Set<DataSource>();
	const scopeTargets: Record<SourceScope, CommonSearchFilters> = {
		ANY: query,
		ECHR: query.scoped.echr,
		RS: query.scoped.rs
	};

	const flattenedRules = flattenGroupRules(group);

	for (const rule of flattenedRules) {
		const value = normalizeText(rule.value || '');
		if (!value) continue;

		const rawScope = rule.sourceScope || 'ANY';
		const scope: SourceScope = isFieldAllowed(rawScope, rule.field)
			? rawScope
			: defaultScopeForField(rule.field);
		const target = scopeTargets[scope];

		switch (rule.field) {
			case 'text':
				if (rule.operator !== 'contains') return { error: 'Only "contains" is supported for Full Text.' };
				addTextQuery(target, value);
				break;
			case 'title':
				addTextQuery(target, value);
				break;
			case 'keywords':
				target.keywords.push(value);
				break;
			case 'ecli':
				target.eclis.push(value);
				break;
			case 'article_violated':
				if (scope === 'RS') return { error: 'Article filters are not supported for Rechtspraak.' };
				query.scoped.echr.articleViolated.push(value);
				break;
			case 'article_applied':
				if (scope === 'RS') return { error: 'Article filters are not supported for Rechtspraak.' };
				query.scoped.echr.articleApplied.push(value);
				break;
			case 'article_non_violated':
				if (scope === 'RS') return { error: 'Article filters are not supported for Rechtspraak.' };
				query.scoped.echr.articleNonViolated.push(value);
				break;
			case 'respondent_state':
				if (rule.operator !== 'equals') return { error: 'Only "is" is supported for Respondent State.' };
				if (scope === 'RS') return { error: 'Respondent State is not supported for Rechtspraak.' };
				query.scoped.echr.respondentState.push(value);
				break;
			case 'year': {
				const year = parseYear(value);
				if (!year) return { error: 'Year must be a 4-digit number.' };
				if (rule.operator === 'equals') {
					if (target.dateStart || target.dateEnd) return { error: 'Multiple year rules are not supported.' };
					target.dateStart = `${year}-01-01`;
					target.dateEnd = `${year}-12-31`;
				} else if (rule.operator === 'after') {
					target.dateStart = `${year}-01-01`;
				} else if (rule.operator === 'before') {
					target.dateEnd = `${year}-12-31`;
				} else {
					return { error: 'Unsupported year operator.' };
				}
				break;
			}
			case 'document_type':
				if (scope === 'RS') {
					query.scoped.rs.documentType.push(value);
				} else if (scope === 'ECHR') {
					query.scoped.echr.documentType.push(value);
				} else {
					query.documentType.push(value);
				}
				break;
			case 'instance':
				if (scope === 'ECHR') return { error: 'Court Instance is not supported for ECHR.' };
				query.scoped.rs.instances.push(value);
				break;
			case 'domain':
				if (scope === 'ECHR') return { error: 'Legal Domain is not supported for ECHR.' };
				query.scoped.rs.domains.push(value);
				break;
			case 'importance': {
				const imp = Number(value);
				if (!Number.isInteger(imp)) return { error: 'Importance must be a number.' };
				if (rule.operator === 'equals') {
					if (scope === 'RS') return { error: 'Importance is not supported for Rechtspraak.' };
					if (scope === 'ECHR') importanceEchr.add(imp);
					else importanceAny.add(imp);
				} else if (rule.operator === 'lte') {
					if (scope === 'RS') return { error: 'Importance is not supported for Rechtspraak.' };
					const targetSet = scope === 'ECHR' ? importanceEchr : importanceAny;
					for (let i = 1; i <= imp; i += 1) targetSet.add(i);
				} else {
					return { error: 'Unsupported importance operator.' };
				}
				break;
			}
			case 'source': {
				if (rule.operator !== 'equals') return { error: 'Only "is" is supported for Data Source.' };
				const upper = value.toUpperCase();
				const src = upper === 'ECHR' || upper === 'HUDOC'
					? DataSource.ECHR
					: upper === 'RS' || upper === 'RECHTSPRAAK'
						? DataSource.RS
						: null;
				if (!src) return { error: `Unknown source "${value}".` };
				sourceSet.add(src);
				break;
			}
			default:
				return { error: `Unsupported field "${rule.field}".` };
		}
	}

	if (importanceAny.size > 0) query.importance = Array.from(importanceAny);
	if (importanceEchr.size > 0) query.scoped.echr.importance = Array.from(importanceEchr);
	if (sourceSet.size > 0) query.sources = Array.from(sourceSet);

	return { query };
}

function splitList(value: string | null): string[] {
	if (!value) return [];
	return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function searchQueryToParams(query: SearchQuery): URLSearchParams {
	const params = new URLSearchParams();
	const defaults = createDefaultSearchQuery();
	const scoped = query.scoped ?? defaults.scoped;

	if (query.text) params.set('q', query.text);
	if (query.sources.join(',') !== defaults.sources.join(',')) params.set('sources', query.sources.join(','));
	if (query.keywords.length) params.set('keywords', query.keywords.join(','));
	if (query.eclis.length) params.set('eclis', query.eclis.join(','));
	if (query.echrCursor) params.set('echrCursor', query.echrCursor);
	if (query.rsCursor) params.set('rsCursor', query.rsCursor);
	if (query.dateStart) params.set('dateStart', query.dateStart);
	if (query.dateEnd) params.set('dateEnd', query.dateEnd);
	if (scoped.echr.text) params.set('echrQ', scoped.echr.text);
	if (scoped.echr.keywords.length) params.set('echrKeywords', scoped.echr.keywords.join(','));
	if (scoped.echr.eclis.length) params.set('echrEclis', scoped.echr.eclis.join(','));
	if (scoped.echr.dateStart) params.set('echrDateStart', scoped.echr.dateStart);
	if (scoped.echr.dateEnd) params.set('echrDateEnd', scoped.echr.dateEnd);
	if (scoped.echr.articleViolated.length) params.set('echrArticleViolated', scoped.echr.articleViolated.join(','));
	if (scoped.echr.articleApplied.length) params.set('echrArticleApplied', scoped.echr.articleApplied.join(','));
	if (scoped.echr.articleNonViolated.length) params.set('echrArticleNonViolated', scoped.echr.articleNonViolated.join(','));
	if (scoped.echr.respondentState.length) params.set('echrRespondentState', scoped.echr.respondentState.join(','));
	if (scoped.echr.documentType.length) params.set('echrDocumentType', scoped.echr.documentType.join(','));
	if (scoped.echr.importance.length) params.set('echrImportance', scoped.echr.importance.join(','));
	if (scoped.rs.text) params.set('rsQ', scoped.rs.text);
	if (scoped.rs.keywords.length) params.set('rsKeywords', scoped.rs.keywords.join(','));
	if (scoped.rs.eclis.length) params.set('rsEclis', scoped.rs.eclis.join(','));
	if (scoped.rs.dateStart) params.set('rsDateStart', scoped.rs.dateStart);
	if (scoped.rs.dateEnd) params.set('rsDateEnd', scoped.rs.dateEnd);
	if (scoped.rs.documentType.length) params.set('rsDocumentType', scoped.rs.documentType.join(','));
	if (scoped.rs.instances.length) params.set('rsInstances', scoped.rs.instances.join(','));
	if (scoped.rs.domains.length) params.set('rsDomains', scoped.rs.domains.join(','));
	if (query.articleViolated.length) params.set('articleViolated', query.articleViolated.join(','));
	if (query.articleApplied.length) params.set('articleApplied', query.articleApplied.join(','));
	if (query.articleNonViolated.length) params.set('articleNonViolated', query.articleNonViolated.join(','));
	if (query.respondentState.length) params.set('respondentState', query.respondentState.join(','));
	if (query.documentType.length) params.set('documentType', query.documentType.join(','));
	if (query.importance.length) params.set('importance', query.importance.join(','));
	if (query.instances.length) params.set('instances', query.instances.join(','));
	if (query.domains.length) params.set('domains', query.domains.join(','));
	if (query.sortBy !== defaults.sortBy) params.set('sortBy', query.sortBy);
	if (query.sortDirection !== defaults.sortDirection) params.set('sortDirection', query.sortDirection);
	if (query.pageSize !== defaults.pageSize) params.set('pageSize', String(query.pageSize));

	return params;
}

function isValidDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function paramsToSearchQuery(params: URLSearchParams): { query?: SearchQuery; error?: string } {
	const query = createDefaultSearchQuery();
	const sourcesRaw = params.get('sources') || params.get('source');
	const sources = splitList(sourcesRaw);

	if (sources.length > 0) {
		const parsedSources: DataSource[] = [];
		for (const source of sources) {
			const upper = source.toUpperCase();
			if (upper === 'ECHR' || upper === 'HUDOC') parsedSources.push(DataSource.ECHR);
			else if (upper === 'RS' || upper === 'RECHTSPRAAK') parsedSources.push(DataSource.RS);
			else return { error: `Unknown source "${source}".` };
		}
		query.sources = Array.from(new Set(parsedSources));
	}

	const q = params.get('q');
	if (q) query.text = q;
	const echrQ = params.get('echrQ');
	if (echrQ) query.scoped.echr.text = echrQ;
	const rsQ = params.get('rsQ');
	if (rsQ) query.scoped.rs.text = rsQ;

	query.keywords = splitList(params.get('keywords'));
	query.eclis = splitList(params.get('eclis'));
	const echrCursor = params.get('echrCursor');
	if (echrCursor) query.echrCursor = echrCursor;
	const rsCursor = params.get('rsCursor');
	if (rsCursor) query.rsCursor = rsCursor;
	query.scoped.echr.keywords = splitList(params.get('echrKeywords'));
	query.scoped.echr.eclis = splitList(params.get('echrEclis'));
	query.scoped.rs.keywords = splitList(params.get('rsKeywords'));
	query.scoped.rs.eclis = splitList(params.get('rsEclis'));
	query.scoped.echr.articleViolated = splitList(params.get('echrArticleViolated'));
	query.scoped.echr.articleApplied = splitList(params.get('echrArticleApplied'));
	query.scoped.echr.articleNonViolated = splitList(params.get('echrArticleNonViolated'));
	query.scoped.echr.respondentState = splitList(params.get('echrRespondentState'));
	query.scoped.echr.documentType = splitList(params.get('echrDocumentType'));
	query.scoped.rs.documentType = splitList(params.get('rsDocumentType'));
	query.scoped.rs.instances = splitList(params.get('rsInstances'));
	query.scoped.rs.domains = splitList(params.get('rsDomains'));
	query.articleViolated = splitList(params.get('articleViolated'));
	query.articleApplied = splitList(params.get('articleApplied'));
	query.articleNonViolated = splitList(params.get('articleNonViolated'));
	query.respondentState = splitList(params.get('respondentState'));
	query.documentType = splitList(params.get('documentType'));
	query.instances = splitList(params.get('instances'));
	query.domains = splitList(params.get('domains'));

	const importance = splitList(params.get('importance'));
	if (importance.length > 0) {
		const parsed = importance.map((v) => Number(v)).filter((v) => Number.isInteger(v));
		if (parsed.length !== importance.length) return { error: 'Importance must be numeric.' };
		query.importance = parsed;
	}
	const echrImportance = splitList(params.get('echrImportance'));
	if (echrImportance.length > 0) {
		const parsed = echrImportance.map((v) => Number(v)).filter((v) => Number.isInteger(v));
		if (parsed.length !== echrImportance.length) return { error: 'ECHR importance must be numeric.' };
		query.scoped.echr.importance = parsed;
	}

	const dateStart = params.get('dateStart');
	const dateEnd = params.get('dateEnd');
	if (dateStart) {
		if (!isValidDate(dateStart)) return { error: 'Invalid dateStart format.' };
		query.dateStart = dateStart;
	}
	if (dateEnd) {
		if (!isValidDate(dateEnd)) return { error: 'Invalid dateEnd format.' };
		query.dateEnd = dateEnd;
	}
	const echrDateStart = params.get('echrDateStart');
	if (echrDateStart) {
		if (!isValidDate(echrDateStart)) return { error: 'Invalid echrDateStart format.' };
		query.scoped.echr.dateStart = echrDateStart;
	}
	const echrDateEnd = params.get('echrDateEnd');
	if (echrDateEnd) {
		if (!isValidDate(echrDateEnd)) return { error: 'Invalid echrDateEnd format.' };
		query.scoped.echr.dateEnd = echrDateEnd;
	}
	const rsDateStart = params.get('rsDateStart');
	if (rsDateStart) {
		if (!isValidDate(rsDateStart)) return { error: 'Invalid rsDateStart format.' };
		query.scoped.rs.dateStart = rsDateStart;
	}
	const rsDateEnd = params.get('rsDateEnd');
	if (rsDateEnd) {
		if (!isValidDate(rsDateEnd)) return { error: 'Invalid rsDateEnd format.' };
		query.scoped.rs.dateEnd = rsDateEnd;
	}

	const sortBy = params.get('sortBy');
	if (sortBy) {
		if (!['relevance', 'date', 'citations', 'importance'].includes(sortBy)) {
			return { error: 'Invalid sortBy value.' };
		}
		query.sortBy = sortBy as SearchQuery['sortBy'];
	}

	const sortDirection = params.get('sortDirection');
	if (sortDirection) {
		if (!['asc', 'desc'].includes(sortDirection)) return { error: 'Invalid sortDirection value.' };
		query.sortDirection = sortDirection as SearchQuery['sortDirection'];
	}

	const pageSize = params.get('pageSize');
	if (pageSize) {
		const num = Number(pageSize);
		if (!Number.isInteger(num) || num < 1) return { error: 'Invalid pageSize value.' };
		query.pageSize = num;
	}

	return { query };
}
