import { createDefaultSearchQuery, DataSource, type ParsedToken, type QueryBuilderGroup, type QueryBuilderRule, type SearchQuery, type CommonSearchFilters, type SourceScope } from '~/lib/types';
import { IMPORTANCE_LEVELS, RECHTSPRAAK_DOMAINS, RECHTSPRAAK_DOMAIN_ALIASES } from '~/lib/utils/constants';
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

	const addExactDateToken = (value: string | undefined, type: ParsedToken['type'], label: string) => {
		if (!value) return;
		addToken({ id: genId(), type, value, display: `${label} ${value}` });
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
	for (const app of [...query.applicationNumbers, ...scoped.echr.applicationNumbers]) {
		addToken({ id: genId(), type: 'application_number', value: app, display: app });
	}
	for (const keyword of [...query.keywords, ...scoped.echr.keywords, ...scoped.rs.keywords]) {
		addToken({ id: genId(), type: 'keyword', value: keyword, display: keyword });
	}
	for (const title of [...query.title, ...scoped.echr.title, ...scoped.rs.title]) {
		addToken({ id: genId(), type: 'title', value: title, display: title });
	}
	for (const ecli of [...query.eclis, ...scoped.echr.eclis, ...scoped.rs.eclis]) {
		addToken({ id: genId(), type: 'ecli', value: ecli, display: ecli });
	}

	addDateTokens(query.dateStart, query.dateEnd);
	addDateTokens(scoped.echr.dateStart, scoped.echr.dateEnd);
	addDateTokens(scoped.rs.dateStart, scoped.rs.dateEnd);
	addExactDateToken(scoped.echr.dateJudgmentStart, 'date_judgment_start', 'Judgment after');
	addExactDateToken(scoped.echr.dateJudgmentEnd, 'date_judgment_end', 'Judgment before');
	addExactDateToken(scoped.echr.dateDecisionStart, 'date_decision_start', 'Decision after');
	addExactDateToken(scoped.echr.dateDecisionEnd, 'date_decision_end', 'Decision before');

	for (const doc of [...query.documentType, ...scoped.echr.documentType, ...scoped.rs.documentType]) {
		addToken({ id: genId(), type: 'document_type', value: doc, display: doc });
	}
	for (const imp of [...query.importance, ...scoped.echr.importance]) {
		const label = IMPORTANCE_LEVELS.find((i) => i.value === imp)?.label || String(imp);
		addToken({ id: genId(), type: 'importance', value: String(imp), display: label });
	}
	for (const lang of [...query.language, ...scoped.echr.language]) {
		addToken({ id: genId(), type: 'language', value: lang, display: lang });
	}
	for (const inst of [...query.instances, ...scoped.rs.instances]) {
		addToken({ id: genId(), type: 'instance', value: inst, display: inst });
	}
	for (const dom of [...query.domains, ...scoped.rs.domains]) {
		addToken({ id: genId(), type: 'domain', value: dom, display: dom });
	}
	for (const article of [...query.articles, ...scoped.rs.articles]) {
		addToken({ id: genId(), type: 'articles', value: article, display: article });
	}
	for (const law of [...query.selectedLaws, ...scoped.rs.selectedLaws]) {
		addToken({ id: genId(), type: 'selected_laws', value: law, display: law });
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

	const addTitle = (values: string[], scope: SourceScope) => {
		for (const value of values) {
			const normalized = normalizeText(value || '');
			if (normalized) pushRule('title', 'contains', normalized, scope);
		}
	};

	const addDateRules = (start: string | undefined, end: string | undefined, scope: SourceScope) => {
		if (!start && !end) return;
		if (start && end && start === end) {
			pushRule('dateStart', 'equals', start, scope);
			return;
		}
		if (start && end) {
			const startYear = start.slice(0, 4);
			const endYear = end.slice(0, 4);
			if (start.endsWith('-01-01') && end.endsWith('-12-31') && startYear === endYear) {
				pushRule('year', 'equals', startYear, scope);
				return;
			}
		}
		if (start) {
			if (start.endsWith('-01-01')) {
				pushRule('year', 'after', start.slice(0, 4), scope);
			} else {
				pushRule('dateStart', 'after', start, scope);
			}
		}
		if (end) {
			if (end.endsWith('-12-31')) {
				pushRule('year', 'before', end.slice(0, 4), scope);
			} else {
				pushRule('dateEnd', 'before', end, scope);
			}
		}
	};

	addText(query.text, 'ANY');
	addTitle(query.title, 'ANY');
	for (const value of query.keywords) pushRule('text', 'contains', value, 'ANY');
	for (const value of query.eclis) pushRule('ecli', 'equals', value, 'ANY');
	addDateRules(query.dateStart, query.dateEnd, 'ANY');
	for (const value of query.articleViolated) pushRule('article_violated', 'equals', value, 'ANY');
	for (const value of query.articleApplied) pushRule('article_applied', 'equals', value, 'ANY');
	for (const value of query.articleNonViolated) pushRule('article_non_violated', 'equals', value, 'ANY');
	for (const value of query.respondentState) pushRule('respondent_state', 'equals', value, 'ANY');
	for (const value of query.applicationNumbers) pushRule('application_number', 'equals', value, 'ANY');
	for (const value of query.documentType) pushRule('document_type', 'equals', value, 'ANY');
	for (const value of query.importance) pushRule('importance', 'equals', String(value), 'ANY');
	for (const value of query.language) pushRule('language', 'equals', value, 'ANY');
	for (const value of query.instances) pushRule('instance', 'equals', value, 'ANY');
	for (const value of query.domains) pushRule('domain', 'equals', value, 'ANY');
	for (const value of query.articles) pushRule('articles', 'contains', value, 'ANY');
	for (const value of query.selectedLaws) pushRule('selectedLaws', 'equals', value, 'ANY');
	if (query.sources.join(',') !== defaults.sources.join(',')) {
		for (const src of query.sources) {
			pushRule('source', 'equals', src, 'ANY');
		}
	}

	addText(scoped.echr.text, 'ECHR');
	addTitle(scoped.echr.title, 'ECHR');
	for (const value of scoped.echr.keywords) pushRule('text', 'contains', value, 'ECHR');
	for (const value of scoped.echr.eclis) pushRule('ecli', 'equals', value, 'ECHR');
	addDateRules(scoped.echr.dateStart, scoped.echr.dateEnd, 'ECHR');
	for (const value of scoped.echr.articleViolated) pushRule('article_violated', 'equals', value, 'ECHR');
	for (const value of scoped.echr.articleApplied) pushRule('article_applied', 'equals', value, 'ECHR');
	for (const value of scoped.echr.articleNonViolated) pushRule('article_non_violated', 'equals', value, 'ECHR');
	for (const value of scoped.echr.respondentState) pushRule('respondent_state', 'equals', value, 'ECHR');
	for (const value of scoped.echr.applicationNumbers) pushRule('application_number', 'equals', value, 'ECHR');
	for (const value of scoped.echr.documentType) pushRule('document_type', 'equals', value, 'ECHR');
	for (const value of scoped.echr.importance) pushRule('importance', 'equals', String(value), 'ECHR');
	for (const value of scoped.echr.language) pushRule('language', 'equals', value, 'ECHR');
	if (scoped.echr.dateJudgmentStart && scoped.echr.dateJudgmentEnd && scoped.echr.dateJudgmentStart === scoped.echr.dateJudgmentEnd) {
		pushRule('date_judgment_start', 'equals', scoped.echr.dateJudgmentStart, 'ECHR');
	} else {
		if (scoped.echr.dateJudgmentStart) {
			pushRule('date_judgment_start', 'after', scoped.echr.dateJudgmentStart, 'ECHR');
		}
		if (scoped.echr.dateJudgmentEnd) {
			pushRule('date_judgment_end', 'before', scoped.echr.dateJudgmentEnd, 'ECHR');
		}
	}
	if (scoped.echr.dateDecisionStart && scoped.echr.dateDecisionEnd && scoped.echr.dateDecisionStart === scoped.echr.dateDecisionEnd) {
		pushRule('date_decision_start', 'equals', scoped.echr.dateDecisionStart, 'ECHR');
	} else {
		if (scoped.echr.dateDecisionStart) {
			pushRule('date_decision_start', 'after', scoped.echr.dateDecisionStart, 'ECHR');
		}
		if (scoped.echr.dateDecisionEnd) {
			pushRule('date_decision_end', 'before', scoped.echr.dateDecisionEnd, 'ECHR');
		}
	}

	addText(scoped.rs.text, 'RS');
	addTitle(scoped.rs.title, 'RS');
	for (const value of scoped.rs.keywords) pushRule('text', 'contains', value, 'RS');
	for (const value of scoped.rs.eclis) pushRule('ecli', 'equals', value, 'RS');
	addDateRules(scoped.rs.dateStart, scoped.rs.dateEnd, 'RS');
	for (const value of scoped.rs.documentType) pushRule('document_type', 'equals', value, 'RS');
	for (const value of scoped.rs.instances) pushRule('instance', 'equals', value, 'RS');
	for (const value of scoped.rs.domains) pushRule('domain', 'equals', value, 'RS');
	for (const value of scoped.rs.articles) pushRule('articles', 'contains', value, 'RS');
	for (const value of scoped.rs.selectedLaws) pushRule('selectedLaws', 'equals', value, 'RS');

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
	const currentYear = new Date().getFullYear();
	if (!Number.isInteger(num) || num < 1900 || num > currentYear) return null;
	return num;
}

function parseDateValue(value: string): string | null {
	const trimmed = normalizeText(value);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
	const today = new Date();
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return null;
	if (date > today) return null;
	return trimmed;
}

function normalizeIso3(value: string): string | null {
	const trimmed = normalizeText(value).toUpperCase();
	if (!/^[A-Z]{3}$/.test(trimmed)) return null;
	return trimmed;
}

const DOMAIN_SET = new Set(RECHTSPRAAK_DOMAINS.map((d) => d.toLowerCase()));
const DOMAIN_ALIAS_MAP = new Map(
	RECHTSPRAAK_DOMAIN_ALIASES.map((entry) => [entry.pattern.toLowerCase(), entry.value]),
);

function normalizeDomainValue(value: string): string {
	const trimmed = normalizeText(value);
	const lower = trimmed.toLowerCase();
	if (!lower) return trimmed;
	if (DOMAIN_SET.has(lower)) {
		return RECHTSPRAAK_DOMAINS.find((d) => d.toLowerCase() === lower) || trimmed;
	}
	return DOMAIN_ALIAS_MAP.get(lower) || trimmed;
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
		if (rule.operator.startsWith('not_')) {
			continue;
		}

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
				target.title.push(value);
				break;
			case 'keywords':
				addTextQuery(target, value);
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
				if (rule.operator !== 'equals') continue;
				if (scope === 'RS') return { error: 'Respondent State is not supported for Rechtspraak.' };
				query.scoped.echr.respondentState.push(value);
				break;
			case 'application_number':
				if (scope === 'RS') return { error: 'Application Number is not supported for Rechtspraak.' };
				query.scoped.echr.applicationNumbers.push(value);
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
			case 'dateStart': {
				const dateValue = parseDateValue(value);
				if (!dateValue) return { error: 'dateStart must be YYYY-MM-DD and not in the future.' };
				if (rule.operator !== 'equals' && rule.operator !== 'after') {
					return { error: 'Unsupported dateStart operator.' };
				}
				target.dateStart = dateValue;
				break;
			}
			case 'dateEnd': {
				const dateValue = parseDateValue(value);
				if (!dateValue) return { error: 'dateEnd must be YYYY-MM-DD and not in the future.' };
				if (rule.operator !== 'equals' && rule.operator !== 'before') {
					return { error: 'Unsupported dateEnd operator.' };
				}
				target.dateEnd = dateValue;
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
				query.scoped.rs.domains.push(normalizeDomainValue(value));
				break;
			case 'articles':
				if (scope === 'ECHR') return { error: 'Articles are not supported for ECHR.' };
				query.scoped.rs.articles.push(value);
				break;
			case 'selectedLaws':
				if (scope === 'ECHR') return { error: 'Selected laws are not supported for ECHR.' };
				query.scoped.rs.selectedLaws.push(value);
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
			case 'language': {
				if (scope === 'RS') return { error: 'Language is not supported for Rechtspraak.' };
				const code = normalizeIso3(value);
				if (!code) return { error: 'Language must be ISO-3.' };
				query.scoped.echr.language.push(code);
				break;
			}
			case 'date_judgment_start': {
				if (scope === 'RS') return { error: 'Judgment date is not supported for Rechtspraak.' };
				const dateValue = parseDateValue(value);
				if (!dateValue) return { error: 'Judgment start date must be YYYY-MM-DD.' };
				if (rule.operator !== 'equals' && rule.operator !== 'after') {
					return { error: 'Unsupported judgment date operator.' };
				}
				query.scoped.echr.dateJudgmentStart = dateValue;
				if (rule.operator === 'equals') {
					query.scoped.echr.dateJudgmentEnd = dateValue;
				}
				break;
			}
			case 'date_judgment_end': {
				if (scope === 'RS') return { error: 'Judgment date is not supported for Rechtspraak.' };
				const dateValue = parseDateValue(value);
				if (!dateValue) return { error: 'Judgment end date must be YYYY-MM-DD.' };
				if (rule.operator !== 'equals' && rule.operator !== 'before') {
					return { error: 'Unsupported judgment date operator.' };
				}
				query.scoped.echr.dateJudgmentEnd = dateValue;
				if (rule.operator === 'equals') {
					query.scoped.echr.dateJudgmentStart = dateValue;
				}
				break;
			}
			case 'date_decision_start': {
				if (scope === 'RS') return { error: 'Decision date is not supported for Rechtspraak.' };
				const dateValue = parseDateValue(value);
				if (!dateValue) return { error: 'Decision start date must be YYYY-MM-DD.' };
				if (rule.operator !== 'equals' && rule.operator !== 'after') {
					return { error: 'Unsupported decision date operator.' };
				}
				query.scoped.echr.dateDecisionStart = dateValue;
				if (rule.operator === 'equals') {
					query.scoped.echr.dateDecisionEnd = dateValue;
				}
				break;
			}
			case 'date_decision_end': {
				if (scope === 'RS') return { error: 'Decision date is not supported for Rechtspraak.' };
				const dateValue = parseDateValue(value);
				if (!dateValue) return { error: 'Decision end date must be YYYY-MM-DD.' };
				if (rule.operator !== 'equals' && rule.operator !== 'before') {
					return { error: 'Unsupported decision date operator.' };
				}
				query.scoped.echr.dateDecisionEnd = dateValue;
				if (rule.operator === 'equals') {
					query.scoped.echr.dateDecisionStart = dateValue;
				}
				break;
			}
			case 'source': {
				if (rule.operator !== 'equals') continue;
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
	if (query.title.length) params.set('title', query.title.join(','));
	if (query.sources.join(',') !== defaults.sources.join(',')) params.set('sources', query.sources.join(','));
	if (query.keywords.length) params.set('keywords', query.keywords.join(','));
	if (query.eclis.length) params.set('eclis', query.eclis.join(','));
	if (query.cursor) params.set('cursor', query.cursor);
	if (query.dateStart) params.set('dateStart', query.dateStart);
	if (query.dateEnd) params.set('dateEnd', query.dateEnd);
	if (scoped.echr.text) params.set('echrQ', scoped.echr.text);
	if (scoped.echr.title.length) params.set('echrTitle', scoped.echr.title.join(','));
	if (scoped.echr.keywords.length) params.set('echrKeywords', scoped.echr.keywords.join(','));
	if (scoped.echr.eclis.length) params.set('echrEclis', scoped.echr.eclis.join(','));
	if (scoped.echr.dateStart) params.set('echrDateStart', scoped.echr.dateStart);
	if (scoped.echr.dateEnd) params.set('echrDateEnd', scoped.echr.dateEnd);
	if (scoped.echr.dateJudgmentStart) params.set('echrJudgmentStart', scoped.echr.dateJudgmentStart);
	if (scoped.echr.dateJudgmentEnd) params.set('echrJudgmentEnd', scoped.echr.dateJudgmentEnd);
	if (scoped.echr.dateDecisionStart) params.set('echrDecisionStart', scoped.echr.dateDecisionStart);
	if (scoped.echr.dateDecisionEnd) params.set('echrDecisionEnd', scoped.echr.dateDecisionEnd);
	if (scoped.echr.articleViolated.length) params.set('echrArticleViolated', scoped.echr.articleViolated.join(','));
	if (scoped.echr.articleApplied.length) params.set('echrArticleApplied', scoped.echr.articleApplied.join(','));
	if (scoped.echr.articleNonViolated.length) params.set('echrArticleNonViolated', scoped.echr.articleNonViolated.join(','));
	if (scoped.echr.respondentState.length) params.set('echrRespondentState', scoped.echr.respondentState.join(','));
	if (scoped.echr.documentType.length) params.set('echrDocumentType', scoped.echr.documentType.join(','));
	if (scoped.echr.importance.length) params.set('echrImportance', scoped.echr.importance.join(','));
	if (scoped.echr.language.length) params.set('echrLanguage', scoped.echr.language.join(','));
	if (scoped.rs.text) params.set('rsQ', scoped.rs.text);
	if (scoped.rs.title.length) params.set('rsTitle', scoped.rs.title.join(','));
	if (scoped.rs.keywords.length) params.set('rsKeywords', scoped.rs.keywords.join(','));
	if (scoped.rs.eclis.length) params.set('rsEclis', scoped.rs.eclis.join(','));
	if (scoped.rs.dateStart) params.set('rsDateStart', scoped.rs.dateStart);
	if (scoped.rs.dateEnd) params.set('rsDateEnd', scoped.rs.dateEnd);
	if (scoped.rs.documentType.length) params.set('rsDocumentType', scoped.rs.documentType.join(','));
	if (scoped.rs.instances.length) params.set('rsInstances', scoped.rs.instances.join(','));
	if (scoped.rs.domains.length) params.set('rsDomains', scoped.rs.domains.join(','));
	if (scoped.rs.articles.length) params.set('rsArticles', scoped.rs.articles.join(','));
	if (scoped.rs.selectedLaws.length) params.set('rsSelectedLaws', scoped.rs.selectedLaws.join(','));
	if (query.articleViolated.length) params.set('articleViolated', query.articleViolated.join(','));
	if (query.articleApplied.length) params.set('articleApplied', query.articleApplied.join(','));
	if (query.articleNonViolated.length) params.set('articleNonViolated', query.articleNonViolated.join(','));
	if (query.respondentState.length) params.set('respondentState', query.respondentState.join(','));
	if (query.documentType.length) params.set('documentType', query.documentType.join(','));
	if (query.importance.length) params.set('importance', query.importance.join(','));
	if (query.language.length) params.set('language', query.language.join(','));
	if (query.instances.length) params.set('instances', query.instances.join(','));
	if (query.domains.length) params.set('domains', query.domains.join(','));
	if (query.articles.length) params.set('articles', query.articles.join(','));
	if (query.selectedLaws.length) params.set('selectedLaws', query.selectedLaws.join(','));
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
	query.title = splitList(params.get('title'));
	const echrQ = params.get('echrQ');
	if (echrQ) query.scoped.echr.text = echrQ;
	query.scoped.echr.title = splitList(params.get('echrTitle'));
	const rsQ = params.get('rsQ');
	if (rsQ) query.scoped.rs.text = rsQ;
	query.scoped.rs.title = splitList(params.get('rsTitle'));

	query.keywords = splitList(params.get('keywords'));
	query.eclis = splitList(params.get('eclis'));
	const cursor = params.get('cursor') || params.get('echrCursor') || params.get('rsCursor');
	if (cursor) query.cursor = cursor;
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
	query.scoped.rs.articles = splitList(params.get('rsArticles'));
	query.scoped.rs.selectedLaws = splitList(params.get('rsSelectedLaws'));
	query.articleViolated = splitList(params.get('articleViolated'));
	query.articleApplied = splitList(params.get('articleApplied'));
	query.articleNonViolated = splitList(params.get('articleNonViolated'));
	query.respondentState = splitList(params.get('respondentState'));
	query.documentType = splitList(params.get('documentType'));
	query.instances = splitList(params.get('instances'));
	query.domains = splitList(params.get('domains'));
	query.articles = splitList(params.get('articles'));
	query.selectedLaws = splitList(params.get('selectedLaws'));

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
	query.language = splitList(params.get('language')).map((v) => v.toUpperCase());
	query.scoped.echr.language = splitList(params.get('echrLanguage')).map((v) => v.toUpperCase());

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
	const echrJudgmentStart = params.get('echrJudgmentStart');
	if (echrJudgmentStart) {
		if (!isValidDate(echrJudgmentStart)) return { error: 'Invalid echrJudgmentStart format.' };
		query.scoped.echr.dateJudgmentStart = echrJudgmentStart;
	}
	const echrJudgmentEnd = params.get('echrJudgmentEnd');
	if (echrJudgmentEnd) {
		if (!isValidDate(echrJudgmentEnd)) return { error: 'Invalid echrJudgmentEnd format.' };
		query.scoped.echr.dateJudgmentEnd = echrJudgmentEnd;
	}
	const echrDecisionStart = params.get('echrDecisionStart');
	if (echrDecisionStart) {
		if (!isValidDate(echrDecisionStart)) return { error: 'Invalid echrDecisionStart format.' };
		query.scoped.echr.dateDecisionStart = echrDecisionStart;
	}
	const echrDecisionEnd = params.get('echrDecisionEnd');
	if (echrDecisionEnd) {
		if (!isValidDate(echrDecisionEnd)) return { error: 'Invalid echrDecisionEnd format.' };
		query.scoped.echr.dateDecisionEnd = echrDecisionEnd;
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
		if (!['date', 'citations'].includes(sortBy)) {
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
