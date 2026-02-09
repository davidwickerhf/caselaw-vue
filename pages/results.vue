<script setup lang="ts">
import {
	ref,
	computed,
	onMounted,
	onBeforeUnmount,
	watch,
	nextTick,
} from "vue";
import { onBeforeRouteLeave } from "vue-router";
import {
	Loader2,
	Filter,
	Brackets,
	ArrowLeft,
	AlertCircle,
	X,
} from "lucide-vue-next";
import AppHeader from "~/components/shared/AppHeader.vue";
import AppFooter from "~/components/shared/AppFooter.vue";
import QueryBuilder from "~/components/search/QueryBuilder.vue";
import ResultList from "~/components/results/ResultList.vue";
import ResultFilters from "~/components/results/ResultFilters.vue";
import ResultDocument from "~/components/results/ResultDocument.vue";
import ResultStats from "~/components/results/ResultStats.vue";
import ResultSort from "~/components/results/ResultSort.vue";
import BulkActions from "~/components/results/BulkActions.vue";
import Button from "~/components/ui/button/Button.vue";
import { useSmartSearch } from "~/composables/useSmartSearch";
import { useSearch } from "~/composables/useSearch";
import { useHistory } from "~/composables/useHistory";
import type { Citation, SearchQuery, QueryBuilderGroup } from "~/lib/types";
import { createDefaultSearchQuery } from "~/lib/types";
import {
	queryBuilderGroupToSearchQuery,
	searchQueryToQueryBuilderGroup,
	paramsToSearchQuery,
} from "~/lib/utils/search-query";
import {
	paramsToQueryBuilderState,
	queryBuilderGroupToParams,
} from "~/lib/utils/query-builder-url";
import { buildQuerySummarySegments } from "~/lib/utils/query-summary";
import { parseNaturalLanguageToQueryBuilderGroup } from "~/lib/parser/nl-query-parser";
import {
	ECHR_ARTICLES,
	RECHTSPRAAK_DOMAINS,
	RECHTSPRAAK_DOMAIN_ALIASES,
	RECHTSPRAAK_INSTANCES,
	RESPONDENT_STATE_CODES,
} from "~/lib/utils/constants";
import { toast } from "vue-sonner";
import {
	defaultScopeForField,
	isFieldAllowed,
	QUERY_BUILDER_FIELDS_BY_SCOPE,
	QUERY_BUILDER_OPERATORS,
} from "~/lib/utils/query-builder-config";
import type { SourceScope } from "~/lib/types";

const route = useRoute();
const router = useRouter();
const store = useSearch();
const history = useHistory();
const smartSearch = useSmartSearch();

const viewMode = ref<"compact" | "expanded">("expanded");
const filtersCollapsed = ref(false);

// --- Resizable panels ---
const FILTER_MIN = 200;
const FILTER_MAX = 420;
const FILTER_DEFAULT = 288; // w-72
const DOC_MIN = 320;
const DOC_MAX_RATIO = 0.6; // max 60% of container
const DOC_DEFAULT_RATIO = 0.45; // 45%

const filterWidth = ref(FILTER_DEFAULT);
const docWidthRatio = ref(DOC_DEFAULT_RATIO);
let resizingPanel: "filter" | "doc" | null = null;
let resizeStartX = 0;
let resizeStartValue = 0;
let containerWidth = 0;

function onResizeStart(event: MouseEvent, panel: "filter" | "doc") {
	event.preventDefault();
	resizingPanel = panel;
	resizeStartX = event.clientX;
	if (panel === "filter") {
		resizeStartValue = filterWidth.value;
	} else {
		const container = (event.target as HTMLElement).closest("[data-resize-container]");
		containerWidth = container?.clientWidth || window.innerWidth;
		resizeStartValue = docWidthRatio.value * containerWidth;
	}
	document.addEventListener("mousemove", onResizeMove);
	document.addEventListener("mouseup", onResizeEnd);
	document.body.style.cursor = "col-resize";
	document.body.style.userSelect = "none";
}

function onResizeMove(event: MouseEvent) {
	if (!resizingPanel) return;
	const dx = event.clientX - resizeStartX;
	if (resizingPanel === "filter") {
		filterWidth.value = Math.min(FILTER_MAX, Math.max(FILTER_MIN, resizeStartValue + dx));
	} else {
		// Dragging left edge of doc panel: moving left = wider doc, moving right = narrower
		const newPx = Math.max(DOC_MIN, resizeStartValue - dx);
		const maxPx = containerWidth * DOC_MAX_RATIO;
		docWidthRatio.value = Math.min(maxPx, newPx) / containerWidth;
	}
}

function onResizeEnd() {
	resizingPanel = null;
	document.removeEventListener("mousemove", onResizeMove);
	document.removeEventListener("mouseup", onResizeEnd);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
}
const syncingRoute = ref(false);
const syncingSmartSearch = ref(false);
const queryBuilderOpen = ref(false);
const routeError = ref<string | null>(null);
const lastAppliedSignature = ref("");
const scopeConflictDetails = computed<{
	echrRules: string[];
	rsRules: string[];
	commonRules: string[];
	fix: string;
} | null>(() => null);
const summaryText = computed(() =>
	summarySegments.value.map((seg) => seg.text).join(""),
);
const summarySegments = computed(() =>
	buildQuerySummarySegments(smartSearch.queryBuilderGroup.value),
);
const marqueeRef = ref<HTMLElement | null>(null);
const summaryRowRef = ref<HTMLElement | null>(null);
const shouldScroll = ref(false);
const isEditingSummary = ref(false);
const invalidRuleKeys = ref<Set<string>>(new Set());
const filterState = ref<Partial<SearchQuery>>({});
let marqueeObserver: ResizeObserver | null = null;
const SCOPE_LABELS: Record<SourceScope, string> = {
	ANY: "Any",
	ECHR: "ECHR",
	RS: "Rechtspraak",
};

function getRuleScope(rule: QueryBuilderGroup["rules"][number]): SourceScope {
	const raw = (rule.sourceScope || defaultScopeForField(rule.field)) as SourceScope;
	return isFieldAllowed(raw, rule.field)
		? raw
		: defaultScopeForField(rule.field);
}

function buildAppliedSignature(group: QueryBuilderGroup) {
	return JSON.stringify({ group });
}

function getFieldLabel(field: string, scope: SourceScope): string {
	const list = QUERY_BUILDER_FIELDS_BY_SCOPE[scope] || QUERY_BUILDER_FIELDS_BY_SCOPE.ANY;
	return list.find((f) => f.value === field)?.label || field;
}

function getOperatorLabel(field: string, op: string): string {
	return QUERY_BUILDER_OPERATORS[field]?.find((o) => o.value === op)?.label || op;
}

function formatRule(rule: QueryBuilderGroup["rules"][number]): string {
	const scope = getRuleScope(rule);
	const scopeLabel = SCOPE_LABELS[scope] || "Any";
	const fieldLabel = getFieldLabel(rule.field, scope);
	const opLabel = getOperatorLabel(rule.field, rule.operator);
	const shouldQuote =
		rule.operator === "contains" ||
		rule.operator === "not_contains" ||
		rule.field === "keywords";
	const valueText = shouldQuote ? `"${rule.value}"` : rule.value;
	return `${scopeLabel}: ${fieldLabel} ${opLabel} ${valueText}`;
}

const ruleIndex = computed(() => {
	const map = new Map<string, QueryBuilderGroup["rules"][number]>();
	const add = (group: QueryBuilderGroup) => {
		group.rules.forEach((rule) => map.set(rule.id, rule));
		group.groups.forEach((sub) => add(sub));
	};
	add(smartSearch.queryBuilderGroup.value);
	return map;
});
const filterQuery = computed(() =>
	applyFilterState(createDefaultSearchQuery(), filterState.value),
);
const CLIENT_ONLY_FIELDS = new Set<string>();
const clientFilterActive = computed(() => {
	if (
		filterState.value.articleViolated?.length ||
		filterState.value.articleApplied?.length ||
		filterState.value.articleNonViolated?.length
	) {
		return true;
	}
	const rules = [
		...smartSearch.queryBuilderGroup.value.rules,
		...smartSearch.queryBuilderGroup.value.groups.flatMap((g) => g.rules),
	];
	return rules.some((rule) => CLIENT_ONLY_FIELDS.has(rule.field));
});

function updateMarquee() {
	if (!marqueeRef.value) {
		shouldScroll.value = false;
		return;
	}
	const containerWidth = marqueeRef.value.clientWidth;
	const span = marqueeRef.value.querySelector(
		".query-text",
	) as HTMLElement | null;
	if (!span) {
		shouldScroll.value = false;
		return;
	}
	const textWidth = span.scrollWidth;
	shouldScroll.value = textWidth > containerWidth * 1.25;
}

function normalizeSummaryValue(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

const ARTICLE_SET = new Set(ECHR_ARTICLES.map((a) => a.number.toUpperCase()));
const DOMAIN_SET = new Set(RECHTSPRAAK_DOMAINS.map((d) => d.toLowerCase()));
const DOMAIN_ALIAS_MAP = new Map(
	RECHTSPRAAK_DOMAIN_ALIASES.map((entry) => [
		entry.pattern.toLowerCase(),
		entry.value,
	]),
);
const INSTANCE_SET = new Set(RECHTSPRAAK_INSTANCES.map((i) => i.toLowerCase()));
const STATE_NAME_SET = new Set(Object.keys(RESPONDENT_STATE_CODES).map((n) => n.toLowerCase()));
const STATE_CODE_MAP = new Map(
	Object.entries(RESPONDENT_STATE_CODES).map(([name, code]) => [code.toUpperCase(), name]),
);
const DOC_TYPES_ECHR = new Set([
	"HEJUD",
	"HEDEC",
	"HECOM",
	"HEINF",
	"HECJUD",
	"HECDEC",
	"HECCOM",
	"HECINF",
]);
const DOC_TYPES_RS = new Set(["DEC", "OPI"]);
const ISO3_RE = /^[A-Z]{3}$/;
const SELECTED_LAW_RE = /^BWBX\d+\|\d+$/i;
const SOURCE_VALUES = new Set([
	"RS",
	"RECHTSPRAAK",
	"ECHR",
	"HUDOC",
	"ANY",
	"BOTH",
	"ALL",
]);
const FILTER_KEYS: (keyof SearchQuery)[] = [
	"sources",
	"articleViolated",
	"articleApplied",
	"articleNonViolated",
	"respondentState",
	"documentType",
	"importance",
	"instances",
	"domains",
	"dateStart",
	"dateEnd",
];

function hasFilterKey(
	filters: Partial<SearchQuery>,
	key: keyof SearchQuery,
): boolean {
	return Object.prototype.hasOwnProperty.call(filters, key);
}

function extractFilterState(query: SearchQuery): Partial<SearchQuery> {
	const next: Partial<SearchQuery> = {};
	const defaultSources = createDefaultSearchQuery().sources;
	if (query.sources?.length && query.sources.join(',') !== defaultSources.join(',')) {
		next.sources = [...query.sources];
	}
	if (query.articleViolated.length) next.articleViolated = [...query.articleViolated];
	if (query.articleApplied.length) next.articleApplied = [...query.articleApplied];
	if (query.articleNonViolated.length)
		next.articleNonViolated = [...query.articleNonViolated];
	if (query.respondentState.length)
		next.respondentState = [...query.respondentState];
	if (query.documentType.length) next.documentType = [...query.documentType];
	if (query.importance.length) next.importance = [...query.importance];
	if (query.instances.length) next.instances = [...query.instances];
	if (query.domains.length) next.domains = [...query.domains];
	if (query.dateStart) next.dateStart = query.dateStart;
	if (query.dateEnd) next.dateEnd = query.dateEnd;
	return next;
}

function applyFilterState(
	base: SearchQuery,
	filters: Partial<SearchQuery>,
): SearchQuery {
	const next: SearchQuery = { ...base, scoped: base.scoped };
	for (const key of FILTER_KEYS) {
		if (!hasFilterKey(filters, key)) continue;
		const value = filters[key];
		if (Array.isArray(value)) {
			(next as SearchQuery)[key] = [...value] as never;
		} else {
			(next as SearchQuery)[key] = value as never;
		}
	}
	return next;
}

function filterStateToRules(filters: Partial<SearchQuery>) {
	const empty = Object.keys(filters).length === 0;
	if (empty) return [];
	const filterQuery = createDefaultSearchQuery();
	for (const key of FILTER_KEYS) {
		if (!hasFilterKey(filters, key)) continue;
		const value = filters[key];
		if (Array.isArray(value)) {
			(filterQuery as SearchQuery)[key] = [...value] as never;
		} else {
			(filterQuery as SearchQuery)[key] = value as never;
		}
	}
	const group = searchQueryToQueryBuilderGroup(filterQuery);
	return group.rules
		.filter((rule) => String(rule.value || "").trim().length > 0)
		.map((rule) => {
			const next = { ...rule };
			if (
				(next.field === "article_violated" ||
					next.field === "article_applied" ||
					next.field === "article_non_violated") &&
				next.operator === "equals"
			) {
				next.operator = "contains";
			}
			if (!isFieldAllowed(next.sourceScope, next.field)) {
				next.sourceScope = defaultScopeForField(next.field);
			}
			return next;
		});
}

function buildEffectiveGroup(
	baseGroup: QueryBuilderGroup,
	filters: Partial<SearchQuery>,
): QueryBuilderGroup {
	const filterRules = filterStateToRules(filters);
	if (filterRules.length === 0) return baseGroup;
	return {
		...baseGroup,
		rules: [...baseGroup.rules, ...filterRules],
		groups: baseGroup.groups.map((group) => ({
			...group,
			rules: [...group.rules],
			groups: [],
		})),
	};
}

function appendFilterParams(
	params: URLSearchParams,
	filters: Partial<SearchQuery>,
) {
	const setList = (key: string, value?: string[] | number[]) => {
		if (!value || value.length === 0) return;
		params.set(key, value.join(","));
	};
	const defaultSources = createDefaultSearchQuery().sources;
	if (filters.sources && filters.sources.length && filters.sources.join(",") !== defaultSources.join(",")) {
		params.set("sources", filters.sources.join(","));
	}
	setList("articleViolated", filters.articleViolated as string[] | undefined);
	setList("articleApplied", filters.articleApplied as string[] | undefined);
	setList(
		"articleNonViolated",
		filters.articleNonViolated as string[] | undefined,
	);
	setList("respondentState", filters.respondentState as string[] | undefined);
	setList("documentType", filters.documentType as string[] | undefined);
	setList("instances", filters.instances as string[] | undefined);
	setList("domains", filters.domains as string[] | undefined);
	setList("importance", filters.importance as number[] | undefined);
	if (filters.dateStart) params.set("dateStart", filters.dateStart);
	if (filters.dateEnd) params.set("dateEnd", filters.dateEnd);
}

function invalidKey(ruleId: string, editType: "scope" | "value") {
	return `${ruleId}:${editType}`;
}

function setInvalid(
	ruleId: string,
	editType: "scope" | "value",
	message: string | null,
) {
	const next = new Set(invalidRuleKeys.value);
	const key = invalidKey(ruleId, editType);
	if (message) {
		next.add(key);
	} else {
		next.delete(key);
	}
	invalidRuleKeys.value = next;
}

function showValidationNotice(message: string) {
	toast.error(message, { duration: 2400, closeButton: true });
}

function parseScopeInput(raw: string): { scope: SourceScope | null; label?: string } {
	const normalized = normalizeSummaryValue(raw).toLowerCase();
	if (!normalized) return { scope: null };
	if (["any", "all", "both"].includes(normalized)) return { scope: "ANY", label: SCOPE_LABELS.ANY };
	if (["echr", "hudoc", "ehrm"].includes(normalized)) return { scope: "ECHR", label: SCOPE_LABELS.ECHR };
	if (["rechtspraak", "rs", "rechtspraak.nl"].includes(normalized)) return { scope: "RS", label: SCOPE_LABELS.RS };
	return { scope: null };
}

function validateScopeValue(
	rule: QueryBuilderGroup["rules"][number],
	value: string,
): { valid: boolean; scope?: SourceScope; label?: string; message?: string } {
	const parsed = parseScopeInput(value);
	if (!parsed.scope) {
		return { valid: false, message: "Unknown data source." };
	}
	if (!isFieldAllowed(parsed.scope, rule.field)) {
		const label = parsed.label || SCOPE_LABELS[parsed.scope];
		return {
			valid: false,
			message: `The field "${rule.field}" is not available for ${label}.`,
		};
	}
	return { valid: true, scope: parsed.scope, label: parsed.label };
}

function validateRuleValue(
	rule: QueryBuilderGroup["rules"][number],
	value: string,
): { valid: boolean; normalized?: string; message?: string } {
	const trimmed = normalizeSummaryValue(value);
	if (!trimmed) {
		return { valid: false, message: "Value cannot be empty." };
	}

	switch (rule.field) {
		case "dateStart":
		case "dateEnd":
		case "date_judgment_start":
		case "date_judgment_end":
		case "date_decision_start":
		case "date_decision_end": {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
				return { valid: false, message: "Date must be YYYY-MM-DD." };
			}
			const parsed = new Date(trimmed);
			if (Number.isNaN(parsed.getTime())) {
				return { valid: false, message: "Invalid date format." };
			}
			if (parsed > new Date()) {
				return { valid: false, message: "Date must not be in the future." };
			}
			return { valid: true, normalized: trimmed };
		}
		case "year": {
			if (!/^\d{4}$/.test(trimmed)) {
				return { valid: false, message: "Year must be a 4-digit value." };
			}
			const year = Number(trimmed);
			const currentYear = new Date().getFullYear();
			if (year < 1900 || year > currentYear) {
				return { valid: false, message: "Year must not be in the future." };
			}
			return { valid: true, normalized: trimmed };
		}
		case "importance": {
			if (!/^[1-4]$/.test(trimmed)) {
				return { valid: false, message: "Importance must be 1 to 4." };
			}
			return { valid: true, normalized: trimmed };
		}
		case "respondent_state": {
			const normalized = trimmed.toLowerCase();
			if (STATE_NAME_SET.has(normalized)) {
				const properName =
					Object.keys(RESPONDENT_STATE_CODES).find(
						(name) => name.toLowerCase() === normalized,
					) || trimmed;
				return { valid: true, normalized: properName };
			}
			const code = trimmed.toUpperCase();
			if (STATE_CODE_MAP.has(code)) {
				return { valid: true, normalized: STATE_CODE_MAP.get(code) };
			}
			return { valid: false, message: "Unknown respondent state." };
		}
		case "article_violated":
		case "article_applied":
		case "article_non_violated": {
			const article = trimmed.toUpperCase();
			if (!ARTICLE_SET.has(article)) {
				return { valid: false, message: "Unknown article reference." };
			}
			return { valid: true, normalized: article };
		}
		case "document_type": {
			const valueUpper = trimmed.toUpperCase();
			const scope = rule.sourceScope || "ANY";
			if (scope === "ECHR" && !DOC_TYPES_ECHR.has(valueUpper)) {
				return { valid: false, message: "Invalid ECHR document type." };
			}
			if (scope === "RS" && !DOC_TYPES_RS.has(valueUpper)) {
				return { valid: false, message: "Invalid Rechtspraak document type." };
			}
			if (scope === "ANY" && !DOC_TYPES_ECHR.has(valueUpper) && !DOC_TYPES_RS.has(valueUpper)) {
				return { valid: false, message: "Invalid document type." };
			}
			return { valid: true, normalized: valueUpper };
		}
		case "instance": {
			const normalized = trimmed.toLowerCase();
			if (!INSTANCE_SET.has(normalized)) {
				return { valid: false, message: "Unknown court instance." };
			}
			const proper =
				RECHTSPRAAK_INSTANCES.find((item) => item.toLowerCase() === normalized) ||
				trimmed;
			return { valid: true, normalized: proper };
		}
		case "domain": {
			const normalized = trimmed.toLowerCase();
			if (!DOMAIN_SET.has(normalized)) {
				const alias = DOMAIN_ALIAS_MAP.get(normalized);
				if (!alias) {
					return { valid: false, message: "Unknown legal domain." };
				}
				return { valid: true, normalized: alias };
			}
			const proper =
				RECHTSPRAAK_DOMAINS.find((item) => item.toLowerCase() === normalized) ||
				trimmed;
			return { valid: true, normalized: proper };
		}
		case "application_number": {
			if (!/^\d{1,6}\/\d{2}$/.test(trimmed)) {
				return { valid: false, message: "Application number must look like 12345/67." };
			}
			return { valid: true, normalized: trimmed };
		}
		case "language": {
			const code = trimmed.toUpperCase();
			if (!ISO3_RE.test(code)) {
				return { valid: false, message: "Language must be an ISO-3 code." };
			}
			return { valid: true, normalized: code };
		}
		case "selectedLaws": {
			if (!SELECTED_LAW_RE.test(trimmed)) {
				return {
					valid: false,
					message: "Selected laws must look like BWBX1234|56.",
				};
			}
			return { valid: true, normalized: trimmed.toUpperCase() };
		}
		case "ecli": {
			if (!/^ECLI:[A-Z]{2}:[A-Z0-9]{2,}:.+$/i.test(trimmed)) {
				return { valid: false, message: "ECLI must start with ECLI:XX:..." };
			}
			return { valid: true, normalized: trimmed.toUpperCase() };
		}
		case "source": {
			const upper = trimmed.toUpperCase();
			if (!SOURCE_VALUES.has(upper)) {
				return { valid: false, message: "Invalid data source." };
			}
			return { valid: true, normalized: upper };
		}
		default:
			return { valid: true, normalized: trimmed };
	}
}

function parseDateValue(value: string): number | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function validateDateRanges(
	group: QueryBuilderGroup,
): { valid: true } | { valid: false; message: string; ruleIds: string[] } {
	const buckets = new Map<
		string,
		{
			start?: number;
			end?: number;
			ruleIds: string[];
		}
	>();
	const allRules = [...group.rules, ...group.groups.flatMap((sub) => sub.rules)];

	const consume = (rule: QueryBuilderGroup["rules"][number]) => {
		const time = parseDateValue(rule.value);
		if (time === null) return;
		const scope = rule.sourceScope || "ANY";
		const key = `${scope}:${rule.field}`;
		const bucket = buckets.get(key) || { ruleIds: [] };
		bucket.ruleIds.push(rule.id);
		if (rule.field.endsWith("_end") || rule.field === "dateEnd") {
			bucket.end = bucket.end === undefined ? time : Math.min(bucket.end, time);
		} else {
			bucket.start = bucket.start === undefined ? time : Math.max(bucket.start, time);
		}
		buckets.set(key, bucket);
	};

	for (const rule of allRules) {
		if (
			![
				"dateStart",
				"dateEnd",
				"date_judgment_start",
				"date_judgment_end",
				"date_decision_start",
				"date_decision_end",
			].includes(rule.field)
		) {
			continue;
		}
		consume(rule);
	}

	for (const bucket of buckets.values()) {
		if (bucket.start !== undefined && bucket.end !== undefined && bucket.start > bucket.end) {
			return {
				valid: false,
				message: "Date start cannot be after date end.",
				ruleIds: bucket.ruleIds,
			};
		}
	}

	return { valid: true };
}
function validateYearRanges(
	group: QueryBuilderGroup,
): { valid: true } | { valid: false; message: string; ruleIds: string[] } {
	const buckets = new Map<
		string,
		{ after?: number; before?: number; equals?: Set<number>; ruleIds: string[] }
	>();
	const allRules = [...group.rules, ...group.groups.flatMap((sub) => sub.rules)];

	for (const rule of allRules) {
		if (rule.field !== "year") continue;
		const year = Number(rule.value);
		if (!Number.isInteger(year)) continue;
		const scope = rule.sourceScope || "ANY";
		const bucket =
			buckets.get(scope) || ({ ruleIds: [], equals: new Set<number>() } as {
				after?: number;
				before?: number;
				equals?: Set<number>;
				ruleIds: string[];
			});
		bucket.ruleIds.push(rule.id);

		if (rule.operator === "after") {
			bucket.after = bucket.after === undefined ? year : Math.max(bucket.after, year);
		} else if (rule.operator === "before") {
			bucket.before = bucket.before === undefined ? year : Math.min(bucket.before, year);
		} else if (rule.operator === "equals") {
			bucket.equals?.add(year);
		}
		buckets.set(scope, bucket);
	}

	for (const bucket of buckets.values()) {
		const equalsYears = Array.from(bucket.equals || []);
		if (equalsYears.length > 1) {
			return {
				valid: false,
				message: "Conflicting year equals filters.",
				ruleIds: bucket.ruleIds,
			};
		}
		if (
			bucket.after !== undefined &&
			bucket.before !== undefined &&
			bucket.after > bucket.before
		) {
			return {
				valid: false,
				message: "Year after cannot be later than year before.",
				ruleIds: bucket.ruleIds,
			};
		}
		if (equalsYears.length === 1) {
			const eq = equalsYears[0];
			if (bucket.after !== undefined && bucket.after > eq) {
				return {
					valid: false,
					message: "Year after conflicts with year equals.",
					ruleIds: bucket.ruleIds,
				};
			}
			if (bucket.before !== undefined && bucket.before < eq) {
				return {
					valid: false,
					message: "Year before conflicts with year equals.",
					ruleIds: bucket.ruleIds,
				};
			}
		}
	}

	return { valid: true };
}

function applySummaryEdits() {
	if (!summaryRowRef.value) return;
	const nodes = Array.from(
		summaryRowRef.value.querySelectorAll<HTMLElement>(
			"[data-rule-id]",
		),
	);
	if (nodes.length === 0) return;

	const edits = new Map<string, string>();
	const scopeEdits = new Map<string, SourceScope>();
	const scopeLabels = new Map<string, string>();
	const revertScopeTargets = new Map<string, string>();
	const revertValueTargets = new Map<string, string>();
	const errors: string[] = [];
	const editedRuleIds = new Set<string>();
	for (const node of nodes) {
		const ruleId = node.dataset.ruleId;
		if (!ruleId) continue;
		const rule = ruleIndex.value.get(ruleId);
		if (!rule) continue;
		const rawValue = node.textContent || "";
		const editType = node.dataset.edit;
		if (editType === "scope") {
			const scopeResult = validateScopeValue(rule, rawValue);
			if (!scopeResult.valid || !scopeResult.scope) {
				revertScopeTargets.set(ruleId, SCOPE_LABELS[rule.sourceScope || "ANY"]);
				setInvalid(
					ruleId,
					"scope",
					scopeResult.message || "Invalid data source.",
				);
				if (scopeResult.message) errors.push(scopeResult.message);
				continue;
			}
			setInvalid(ruleId, "scope", null);
			scopeEdits.set(ruleId, scopeResult.scope);
			scopeLabels.set(ruleId, scopeResult.label || SCOPE_LABELS[scopeResult.scope]);
			node.textContent = scopeResult.label || SCOPE_LABELS[scopeResult.scope];
			editedRuleIds.add(ruleId);
			continue;
		}

		const result = validateRuleValue(rule, rawValue);
		if (!result.valid) {
			revertValueTargets.set(ruleId, rule.value);
			setInvalid(ruleId, "value", result.message || "Invalid value.");
			if (result.message) errors.push(result.message);
			continue;
		}
		setInvalid(ruleId, "value", null);
		const normalized = result.normalized ?? normalizeSummaryValue(rawValue);
		edits.set(ruleId, normalized);
		node.textContent = normalized;
		editedRuleIds.add(ruleId);
	}

	if (
		revertScopeTargets.size > 0 ||
		revertValueTargets.size > 0
	) {
		for (const node of nodes) {
			const ruleId = node.dataset.ruleId;
			if (!ruleId) continue;
			const editType = node.dataset.edit;
			if (editType === "scope") {
				const revertValue = revertScopeTargets.get(ruleId);
				if (revertValue !== undefined) {
					node.textContent = revertValue;
				}
			} else {
				const revertValue = revertValueTargets.get(ruleId);
				if (revertValue !== undefined) {
					node.textContent = revertValue;
				}
			}
		}
		const message = errors.length > 0 ? errors[0] : "Invalid value.";
		showValidationNotice(message);
		invalidRuleKeys.value = new Set();
		return;
	}

	let changed = false;
	const updateRules = (rules: QueryBuilderGroup["rules"]) =>
		rules.map((rule) => {
			const nextScope = scopeEdits.get(rule.id);
			const nextValue = edits.get(rule.id);
			if (nextScope === undefined && nextValue === undefined) return rule;
			const updated = {
				...rule,
				sourceScope: nextScope || rule.sourceScope,
				value: nextValue ?? rule.value,
			};
			if (updated.sourceScope === rule.sourceScope && updated.value === rule.value) return rule;
			changed = true;
			return updated;
		});

	const nextGroup: QueryBuilderGroup = {
		...smartSearch.queryBuilderGroup.value,
		rules: updateRules(smartSearch.queryBuilderGroup.value.rules),
		groups: smartSearch.queryBuilderGroup.value.groups.map((group) => ({
			...group,
			rules: updateRules(group.rules),
			groups: [],
		})),
	};

	if (!changed) return;

	for (const rule of [
		...nextGroup.rules,
		...nextGroup.groups.flatMap((group) => group.rules),
	]) {
		if (!editedRuleIds.has(rule.id)) continue;
		const validation = validateRuleValue(rule, rule.value);
		if (!validation.valid) {
			const original = ruleIndex.value.get(rule.id);
			const scopeEdited = scopeEdits.has(rule.id);
			const valueEdited = edits.has(rule.id);
			if (scopeEdited && !valueEdited) {
				setInvalid(
					rule.id,
					"scope",
					validation.message || "Invalid value for selected dataset.",
				);
			} else {
				setInvalid(rule.id, "value", validation.message || "Invalid value.");
			}
			for (const node of nodes) {
				const ruleId = node.dataset.ruleId;
				if (ruleId !== rule.id) continue;
				if (!original) continue;
				if (node.dataset.edit === "scope") {
					if (scopeEdited) {
						node.textContent = SCOPE_LABELS[original.sourceScope || "ANY"];
					}
				} else if (node.dataset.edit === "value") {
					if (valueEdited || !scopeEdited) {
						node.textContent = original.value;
					}
				}
			}
			showValidationNotice(validation.message || "Invalid value.");
			invalidRuleKeys.value = new Set();
			return;
		}
	}

	const rangeValidation = validateYearRanges(nextGroup);
	if (!rangeValidation.valid) {
		for (const ruleId of rangeValidation.ruleIds) {
			setInvalid(ruleId, "value", rangeValidation.message);
		}
		for (const node of nodes) {
			const ruleId = node.dataset.ruleId;
			if (!ruleId) continue;
			if (node.dataset.edit !== "value") continue;
			const rule = ruleIndex.value.get(ruleId);
			if (rule) node.textContent = rule.value;
		}
		showValidationNotice(rangeValidation.message);
		invalidRuleKeys.value = new Set();
		return;
	}
	const dateValidation = validateDateRanges(nextGroup);
	if (!dateValidation.valid) {
		for (const ruleId of dateValidation.ruleIds) {
			setInvalid(ruleId, "value", dateValidation.message);
		}
		for (const node of nodes) {
			const ruleId = node.dataset.ruleId;
			if (!ruleId) continue;
			if (node.dataset.edit !== "value") continue;
			const rule = ruleIndex.value.get(ruleId);
			if (rule) node.textContent = rule.value;
		}
		showValidationNotice(dateValidation.message);
		invalidRuleKeys.value = new Set();
		return;
	}

	smartSearch.onQueryBuilderEdit(nextGroup);
	applyQueryBuilderEdits();
}

function handleSummaryFocusIn() {
	isEditingSummary.value = true;
}

function handleSummaryFocusOut() {
	globalThis.setTimeout(() => {
		if (summaryRowRef.value?.contains(document.activeElement)) return;
		isEditingSummary.value = false;
		applySummaryEdits();
	}, 120);
}

function handleSummaryInput(event: Event) {
	const target = event.currentTarget as HTMLElement | null;
	const ruleId = target?.dataset.ruleId;
	if (!ruleId) return;
	const rule = ruleIndex.value.get(ruleId);
	if (!rule) return;
	const rawValue = target?.textContent || "";
	const editType = target?.dataset.edit;
	if (editType === "scope") {
		const scopeResult = validateScopeValue(rule, rawValue);
		if (!scopeResult.valid) {
			setInvalid(ruleId, "scope", scopeResult.message || "Invalid data source.");
		} else {
			setInvalid(ruleId, "scope", null);
		}
		return;
	}
	const result = validateRuleValue(rule, rawValue);
	if (!result.valid) {
		setInvalid(ruleId, "value", result.message || "Invalid value.");
	} else {
		setInvalid(ruleId, "value", null);
	}
}

function handleSummaryEnter(event: KeyboardEvent) {
	event.preventDefault();
	const target = event.currentTarget as HTMLElement | null;
	target?.blur();
	handleSummaryFocusOut();
}
const estimatedTotalPages = computed(() => {
	if (!store.results.value) return 0;
	const pages = Math.ceil(
		store.results.value.total / store.query.value.pageSize,
	);
	return Math.max(store.query.value.page, pages);
});

function applyQueryAndSearch(
	query: SearchQuery,
	updateUrl: boolean,
	opts: { baseGroup?: QueryBuilderGroup; requestGroup?: QueryBuilderGroup } = {},
) {
	const baseGroup = opts.baseGroup || smartSearch.queryBuilderGroup.value;
	const requestGroup = opts.requestGroup || baseGroup;
	store.setQuery({
		...query,
		page: query.page || 1,
		queryBuilderGroup: requestGroup,
	});
	store.search();
	if (baseGroup) {
		lastAppliedSignature.value = buildAppliedSignature(baseGroup);
	}
	if (updateUrl) {
		const includeSearchString = !!smartSearch.searchString.value;
		const params = queryBuilderGroupToParams(
			baseGroup,
			{
				pageSize: query.pageSize,
				cursor: query.cursor,
				searchString: includeSearchString
					? smartSearch.searchString.value
					: undefined,
				sortBy: query.sortBy,
				sortDirection: query.sortDirection,
				page: query.page,
			},
		);
		appendFilterParams(params, filterState.value);
		syncingRoute.value = true;
		router
			.replace({
				path: "/results",
				query: Object.fromEntries(params.entries()),
			})
			.finally(() => {
				syncingRoute.value = false;
			});
	}
}

function applyQueryBuilderEdits() {
	const group = smartSearch.queryBuilderGroup.value;
	const signature = buildAppliedSignature(group);
	if (signature === lastAppliedSignature.value) return;

	const rangeValidation = validateYearRanges(group);
	if (!rangeValidation.valid) {
		showValidationNotice(rangeValidation.message);
		return;
	}
	const dateValidation = validateDateRanges(group);
	if (!dateValidation.valid) {
		showValidationNotice(dateValidation.message);
		return;
	}

	const parsed = queryBuilderGroupToSearchQuery(group);
	if (!parsed.query) {
		handleInvalidRoute(parsed.error || "Unable to parse query builder.");
		return;
	}
	routeError.value = null;
	const mergedQuery = applyFilterState(parsed.query, filterState.value);
	const nextQuery: SearchQuery = {
		...mergedQuery,
		sortBy: store.query.value.sortBy,
		sortDirection: store.query.value.sortDirection,
		pageSize: store.query.value.pageSize,
		page: 1,
		cursor: undefined,
	};
	store.resetPagination();
	const requestGroup = buildEffectiveGroup(group, filterState.value);
	applyQueryAndSearch(nextQuery, true, {
		baseGroup: group,
		requestGroup,
	});
}

function handleInvalidRoute(error: string) {
	toast.error(error, { duration: 4000, closeButton: true });
	store.resetQuery();
	smartSearch.clearAll();
	syncingRoute.value = true;
	router.replace({ path: "/results" }).finally(() => {
		syncingRoute.value = false;
	});
}

function handleClear() {
	routeError.value = null;
	store.resetQuery();
	smartSearch.clearAll();
	smartSearch.setFromText("");
	smartSearch.setSearchString("");
	smartSearch.lastEditSource.value = "searchbar";
	filterState.value = {};
	lastAppliedSignature.value = "";
	syncingRoute.value = true;
	router.replace({ path: "/results" }).finally(() => {
		syncingRoute.value = false;
	});
}

function applyRouteQuery() {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(route.query)) {
		if (Array.isArray(value)) params.set(key, value.join(","));
		else if (value) params.set(key, value);
	}
	let shouldNormalize = !params.has("qb");

	if ([...params.keys()].length === 0) {
		filterState.value = {};
		if (
			smartSearch.confirmedTokens.value.length > 0 ||
			smartSearch.freeText.value
		) {
			const query = smartSearch.buildSearchQuery();
			routeError.value = null;
			store.resetPagination();
			applyQueryAndSearch({ ...query, page: 1, cursor: undefined }, true);
		} else {
			store.resetQuery();
			routeError.value = null;
		}
		return;
	}

	const parsed = paramsToQueryBuilderState(params);
	if (!parsed.state) {
		const searchString = params.get("searchString");
		if (searchString) {
			const group = parseNaturalLanguageToQueryBuilderGroup(searchString);
			const searchResult = queryBuilderGroupToSearchQuery(group);
			if (!searchResult.query) {
				handleInvalidRoute(
					searchResult.error || "Unable to parse query builder.",
				);
				return;
			}
			filterState.value = {};
			const nextQuery: SearchQuery = {
				...searchResult.query,
				pageSize: searchResult.query.pageSize,
				cursor: undefined,
				page: 1,
				sortBy: searchResult.query.sortBy,
				sortDirection: searchResult.query.sortDirection,
			};
			routeError.value = null;
			syncingSmartSearch.value = true;
			smartSearch.setSearchString(searchString);
			smartSearch.queryBuilderGroup.value = group;
			smartSearch.lastEditSource.value = "searchbar";
			nextTick(() => {
				syncingSmartSearch.value = false;
			});
			store.resetPagination();
			applyQueryAndSearch(nextQuery, true, {
				baseGroup: group,
				requestGroup: buildEffectiveGroup(group, filterState.value),
			});
			return;
		}
		handleInvalidRoute(parsed.error || "Invalid URL parameters.");
		return;
	}

	const group = parsed.state.group;
	const searchResult = queryBuilderGroupToSearchQuery(group);
	if (!searchResult.query) {
		handleInvalidRoute(searchResult.error || "Unable to parse query builder.");
		return;
	}

	const filterParsed = paramsToSearchQuery(params);
	const filterError = filterParsed.error || null;
	if (filterError) {
		routeError.value = filterError;
		filterState.value = {};
		shouldNormalize = true;
	} else if (filterParsed.query) {
		filterState.value = extractFilterState(filterParsed.query);
	}

	const mergedQuery = applyFilterState(searchResult.query, filterState.value);
	const nextQuery: SearchQuery = {
		...mergedQuery,
		pageSize: parsed.state.pageSize || mergedQuery.pageSize,
		cursor: parsed.state.cursor,
		page: parsed.state.page || 1,
		sortBy: parsed.state.sortBy || mergedQuery.sortBy,
		sortDirection: parsed.state.sortDirection || mergedQuery.sortDirection,
	};

	if (!filterError) {
		routeError.value = null;
	}
	syncingSmartSearch.value = true;
	if (parsed.state.searchString) {
		smartSearch.setSearchString(parsed.state.searchString);
		smartSearch.queryBuilderGroup.value = group;
		smartSearch.lastEditSource.value = "searchbar";
	} else {
		smartSearch.setSearchString("");
		smartSearch.onQueryBuilderEdit(group);
	}
	nextTick(() => {
		syncingSmartSearch.value = false;
	});
	store.resetPagination();
	const requestGroup = buildEffectiveGroup(group, filterState.value);
	applyQueryAndSearch(nextQuery, shouldNormalize, {
		baseGroup: group,
		requestGroup,
	});
	lastAppliedSignature.value = buildAppliedSignature(group);
}

onMounted(() => {
	applyRouteQuery();
	nextTick(updateMarquee);
	if (typeof ResizeObserver !== "undefined") {
		marqueeObserver = new ResizeObserver(() => updateMarquee());
		if (marqueeRef.value) marqueeObserver.observe(marqueeRef.value);
	}
});

onBeforeRouteLeave(() => {
	store.abortAll();
});

watch(
	() => route.query,
	() => {
		if (syncingRoute.value) return;
		applyRouteQuery();
	},
	{ deep: true },
);

watch(summaryText, () => {
	nextTick(updateMarquee);
});

onBeforeUnmount(() => {
	if (marqueeObserver) marqueeObserver.disconnect();
	marqueeObserver = null;
});

watch(
	() => queryBuilderOpen.value,
	(isOpen, wasOpen) => {
		if (syncingSmartSearch.value) return;
		if (wasOpen && !isOpen) {
			applyQueryBuilderEdits();
		}
	},
);

function handleSubmit() {
	const parsed = queryBuilderGroupToSearchQuery(
		smartSearch.queryBuilderGroup.value,
	);
	if (!parsed.query) {
		handleInvalidRoute(parsed.error || "Unable to parse query builder.");
		return;
	}
	routeError.value = null;
	const mergedQuery = applyFilterState(parsed.query, filterState.value);
	const nextQuery: SearchQuery = {
		...mergedQuery,
		sortBy: store.query.value.sortBy,
		sortDirection: store.query.value.sortDirection,
		pageSize: store.query.value.pageSize,
		page: 1,
		cursor: undefined,
	};
	store.resetPagination();
	const requestGroup = buildEffectiveGroup(
		smartSearch.queryBuilderGroup.value,
		filterState.value,
	);
	applyQueryAndSearch(nextQuery, true, {
		baseGroup: smartSearch.queryBuilderGroup.value,
		requestGroup,
	});
	const includeSearchString =
		smartSearch.lastEditSource.value === "searchbar" &&
		!!smartSearch.searchString.value;
	const rawSearchText = includeSearchString
		? smartSearch.searchString.value
		: "";
	history.add(store.query.value, store.results.value?.total, rawSearchText);
}

function handleEditSearch() {
	store.abortAll();
	if (
		!smartSearch.searchString.value &&
		smartSearch.lastEditSource.value === "searchbar" &&
		smartSearch.rawText.value.trim()
	) {
		smartSearch.setSearchString(smartSearch.rawText.value);
	}
	const includeSearchString = !!smartSearch.searchString.value;
	const params = queryBuilderGroupToParams(
		smartSearch.queryBuilderGroup.value,
		{
			searchString: includeSearchString
				? smartSearch.searchString.value
				: undefined,
		},
	);
	router.push({ path: "/", query: Object.fromEntries(params.entries()) });
}

function handleFilterChange(partial: Partial<SearchQuery>) {
	store.resetPagination();
	filterState.value = { ...filterState.value, ...partial };
	const merged = applyFilterState(store.query.value, filterState.value);
	const next = { ...merged, page: 1, cursor: undefined };
	const requestGroup = buildEffectiveGroup(
		smartSearch.queryBuilderGroup.value,
		filterState.value,
	);
	applyQueryAndSearch(next, true, {
		baseGroup: smartSearch.queryBuilderGroup.value,
		requestGroup,
	});
}

function handlePageChange(page: number) {
	if (page < 1) return;
	const cursor = store.cursorHistory.value[page];
	// For cursor-based (non-client-filter) pagination: if we don't have a cursor
	// for this page and it's not page 1, we can't navigate there.
	if (!clientFilterActive.value && page > 1 && !cursor) return;
	const requestGroup = buildEffectiveGroup(
		smartSearch.queryBuilderGroup.value,
		filterState.value,
	);
	applyQueryAndSearch(
		{
			...store.query.value,
			page,
			cursor: clientFilterActive.value ? undefined : (cursor ?? undefined),
		},
		true,
		{ baseGroup: smartSearch.queryBuilderGroup.value, requestGroup },
	);
}

function handlePageSizeChange(size: number) {
	store.resetPagination();
	const requestGroup = buildEffectiveGroup(
		smartSearch.queryBuilderGroup.value,
		filterState.value,
	);
	applyQueryAndSearch(
		{
			...store.query.value,
			pageSize: size,
			page: 1,
			cursor: undefined,
		},
		true,
		{ baseGroup: smartSearch.queryBuilderGroup.value, requestGroup },
	);
}

function handleSelectResult(citation: Citation) {
	store.selectResult(citation);
}

function handleDidYouMean(text: string) {
	smartSearch.setFromText(text);
	handleSubmit();
}

function handleFindSimilar(citation: Citation) {
	const terms = [citation.title, ...(citation.keywords || []).slice(0, 3)]
		.filter(Boolean)
		.join(" ");
	smartSearch.setFromText(terms);
	handleSubmit();
	store.closeDetail();
}
</script>

<template>
	<div class="h-screen overflow-hidden bg-background">
		<AppHeader fixed />

		<main class="h-full box-border pt-12 overflow-hidden">
			<div class="flex h-full flex-col">
				<!-- Query summary row -->
				<div class="shrink-0 bg-background">
					<div
						class="flex h-12 w-full items-stretch border-b border-border p-0 m-0"
					>
						<button
							class="group flex h-full items-center justify-center gap-2 px-4 text-sm font-semibold text-muted-foreground transition-all duration-200 ease-out hover:text-foreground hover:bg-muted/40 active:scale-[0.98]"
							@click="handleEditSearch"
						>
							<ArrowLeft
								class="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
							/>
							Edit Search
						</button>
						<div class="w-px self-stretch bg-border" />

							<div class="flex-1 min-w-0">
								<div class="flex h-full items-center px-6 min-w-0">
									<div
										v-if="summarySegments.length"
										ref="marqueeRef"
										class="query-marquee"
										:title="summaryText"
										@focusin="handleSummaryFocusIn"
										@focusout="handleSummaryFocusOut"
									>
										<div
											:class="[
												'query-marquee-track',
												shouldScroll && !isEditingSummary ? 'is-scrolling' : '',
											]"
											ref="summaryRowRef"
										>
											<span class="query-text">
												<template
													v-for="(segment, idx) in summarySegments"
													:key="`${segment.type}-${segment.type === 'value' ? segment.ruleId : idx}`"
												>
													<span v-if="segment.type === 'text'">{{ segment.text }}</span>
													<span
														v-else-if="segment.type === 'scope'"
														:class="[
															'query-value query-scope',
															invalidRuleKeys.has(
																`${segment.ruleId}:scope`,
															)
																? 'query-value-invalid'
																: '',
														]"
														contenteditable="true"
														spellcheck="false"
														:data-rule-id="segment.ruleId"
														data-edit="scope"
														@input="handleSummaryInput"
														@keyup="handleSummaryInput"
														@paste="handleSummaryInput"
														@keydown.enter="handleSummaryEnter"
													>
														{{ segment.text }}
													</span>
													<span
														v-else
														:class="[
															'query-value',
															invalidRuleKeys.has(
																`${segment.ruleId}:value`,
															)
																? 'query-value-invalid'
																: '',
														]"
														contenteditable="true"
														spellcheck="false"
														:data-rule-id="segment.ruleId"
														data-edit="value"
														@input="handleSummaryInput"
														@keyup="handleSummaryInput"
														@paste="handleSummaryInput"
														@keydown.enter="handleSummaryEnter"
													>
														{{ segment.text }}
													</span>
												</template>
											</span>
											<span
												v-if="shouldScroll && !isEditingSummary"
												class="query-text"
												aria-hidden="true"
												>{{ summaryText }}</span
											>
										</div>
									</div>
								<span v-else class="text-xs text-muted-foreground"
									>No search parameters</span
								>
							</div>
						</div>

						<div class="w-px self-stretch bg-border" />
						<button
							class="group flex h-full w-40 shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold text-muted-foreground transition-all duration-200 ease-out hover:text-foreground hover:bg-muted/40 active:scale-[0.98]"
							@click="queryBuilderOpen = true"
						>
							<Brackets
								class="h-4 w-4 transition-transform group-hover:scale-105"
							/>
							Query Builder
						</button>
						<div class="w-px self-stretch bg-border" />
						<button
							class="group flex h-full w-12 shrink-0 items-center justify-center px-0 text-sm font-semibold text-muted-foreground transition-all duration-200 ease-out hover:text-foreground hover:bg-muted/40 active:scale-[0.98]"
							@click="handleClear"
							aria-label="Clear search"
							title="Clear search"
						>
							<X class="h-4 w-4 transition-transform group-hover:scale-105" />
						</button>
					</div>
					<div v-if="routeError" class="px-6 pb-2">
						<div
							class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
						>
							{{ routeError }}
						</div>
					</div>
				</div>

				<!-- Main content -->
				<div class="mx-auto flex w-full min-h-0 flex-1 gap-0 px-0" data-resize-container>
					<!-- Left sidebar: Filters -->
					<aside
						v-if="store.results.value && !filtersCollapsed"
						class="shrink-0 pt-4 pr-0 pb-0 pl-0 h-full overflow-hidden"
						:style="{ width: filterWidth + 'px' }"
					>
						<ResultFilters
							:facets="store.results.value.facets"
							:query="filterQuery"
							@change="handleFilterChange"
							@toggle-collapse="filtersCollapsed = true"
						/>
					</aside>
					<!-- Filter resize handle -->
					<div
						v-if="store.results.value && !filtersCollapsed"
						class="drag-handle shrink-0 relative z-10"
						@mousedown="onResizeStart($event, 'filter')"
					>
						<div class="h-full w-px bg-border" />
					</div>

					<!-- Center: Results -->
					<section
						:class="[
							'flex min-h-0 flex-1 flex-col pt-6 pb-0 pl-6 min-w-0',
							store.detailOpen.value ? 'pr-4' : 'pr-6'
						]"
					>
						<!-- Loading (initial search only, not pagination) -->
						<div
							v-if="store.loading.value && !store.results.value"
							class="flex flex-1 items-center justify-center"
						>
							<div class="text-center space-y-3">
								<Loader2
									class="h-8 w-8 animate-spin text-muted-foreground mx-auto"
								/>
								<p class="text-sm text-muted-foreground">Searching cases...</p>
							</div>
						</div>

						<!-- Error -->
						<div
							v-else-if="store.error.value"
							class="flex flex-1 items-center justify-center"
						>
							<div class="text-center space-y-3 max-w-lg">
								<AlertCircle class="h-8 w-8 text-red-500 mx-auto" />
								<p class="text-sm font-medium text-foreground">Search failed</p>
								<template v-if="scopeConflictDetails">
									<p class="text-xs text-muted-foreground">
										This query combines ECHR-only and Rechtspraak-only rules with
										<span class="font-semibold text-foreground">AND</span>, so no dataset can satisfy all conditions.
									</p>
									<div class="text-xs text-muted-foreground space-y-1">
										<p class="font-semibold text-foreground/80">ECHR-only rules</p>
										<p>{{ scopeConflictDetails.echrRules.join(" AND ") }}</p>
									</div>
									<div class="text-xs text-muted-foreground space-y-1">
										<p class="font-semibold text-foreground/80">Rechtspraak-only rules</p>
										<p>{{ scopeConflictDetails.rsRules.join(" AND ") }}</p>
									</div>
									<div v-if="scopeConflictDetails.commonRules.length" class="text-xs text-muted-foreground space-y-1">
										<p class="font-semibold text-foreground/80">Common rules</p>
										<p>{{ scopeConflictDetails.commonRules.join(" AND ") }}</p>
									</div>
									<div class="rounded-lg border border-border/50 bg-card/60 p-3 text-xs text-muted-foreground">
										<p class="font-semibold text-foreground/80 mb-1">Suggested fix</p>
										<p>{{ scopeConflictDetails.fix }}</p>
									</div>
								</template>
								<p v-else class="text-xs text-muted-foreground">
									{{ store.error.value }}
								</p>
								<Button variant="outline" size="sm" @click="store.search()">
									Retry
								</Button>
							</div>
						</div>

						<!-- Results -->
						<div
							v-else-if="store.results.value"
							class="flex min-h-0 flex-1 flex-col gap-0"
						>
							<!-- Toolbar: stats + sort + actions -->
							<div class="flex flex-col gap-2.5 pb-4">
								<!-- Row 1: Filter button + result count + bulk actions -->
								<div class="flex items-center justify-between gap-3 flex-wrap">
									<ResultStats
										:total="store.results.value.total"
										:total-is-exact="store.results.value.totalIsExact"
										:rs-total="store.results.value.rsTotal"
										:echr-total="store.results.value.echrTotal"
										:has-more="!!store.results.value.nextCursor"
										:loading-more="store.results.value.loadingMore"
										:ai-summary="store.results.value.aiSummary"
										:did-you-mean="store.results.value.didYouMean"
										@did-you-mean="handleDidYouMean"
									>
								<template #countPrefix>
									<button
										class="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-muted/50"
										@click="filtersCollapsed = !filtersCollapsed"
									>
										<Filter class="h-3 w-3" />
										Filters
									</button>
								</template>
									</ResultStats>
									<BulkActions
										:selected-count="store.selectedCount.value"
										:total-count="store.results.value.results.length"
										:disabled="store.loading.value"
										@select-all="store.selectAll()"
										@clear="store.clearSelection()"
										@export="(format) => store.exportSelected(format)"
									/>
								</div>

								<!-- Row 2: Sort + view toggle -->
								<div class="flex items-center justify-between gap-3 flex-wrap">
									<ResultSort
										:sort-by="store.query.value.sortBy"
										:sort-direction="store.query.value.sortDirection"
										:view-mode="viewMode"
										:disabled="store.loading.value"
										@change="
											(sortBy: string, dir: string) => {
												store.resetPagination();
												const requestGroup = buildEffectiveGroup(
													smartSearch.queryBuilderGroup.value,
													filterState,
												);
												applyQueryAndSearch(
													{
														...store.query.value,
														sortBy: sortBy as
															| 'date'
															| 'citations',
														sortDirection: dir as 'asc' | 'desc',
														page: 1,
														cursor: undefined,
													},
													true,
													{
														baseGroup: smartSearch.queryBuilderGroup.value,
														requestGroup,
													},
												);
											}
										"
										@view-change="(mode) => (viewMode = mode)"
									/>
								</div>
							</div>

						<!-- Results list -->
						<div class="min-h-0 flex-1 overflow-y-auto pb-16">
								<ResultList
									:results="store.results.value.results"
									:query="store.query.value.text"
									:selected-result-id="store.selectedResult.value?.id"
									:selected-ids="store.selectedIds.value"
									:page="store.query.value.page"
									:page-size="store.query.value.pageSize"
									:total-pages="store.totalPages.value || undefined"
									:has-next="!!store.results.value.nextCursor"
									:estimated-total-pages="estimatedTotalPages || undefined"
									:total-is-exact="store.results.value.totalIsExact"
									:disabled="store.loading.value"
									:loading="store.loading.value"
									:view-mode="viewMode"
									@select="handleSelectResult"
									@toggle="(id) => store.toggleSelection(id)"
									@page="handlePageChange"
									@page-size-change="handlePageSizeChange"
								/>
						</div>
						</div>

						<!-- Empty state -->
						<div v-else class="flex flex-1 items-center justify-center">
							<p class="text-muted-foreground">
								Enter a search query to find cases.
							</p>
						</div>
					</section>

					<!-- Inline document view (full height) -->
					<template v-if="store.detailOpen.value">
						<!-- Document resize handle -->
						<div
							class="drag-handle shrink-0 relative z-10"
							@mousedown="onResizeStart($event, 'doc')"
						>
							<div class="h-full w-px bg-border" />
						</div>
						<aside
							class="shrink-0 min-h-0 overflow-hidden"
							:style="{ width: (docWidthRatio * 100) + '%' }"
						>
							<ResultDocument
								:citation="store.selectedResult.value"
								@close="store.closeDetail()"
								@find-similar="handleFindSimilar"
								@select-citation="handleSelectResult"
							/>
						</aside>
					</template>
				</div>
			</div>
		</main>

		<AppFooter />

		<!-- Query builder modal -->
		<Teleport to="body">
			<Transition
				enter-active-class="transition-opacity duration-200 ease-out"
				enter-from-class="opacity-0"
				enter-to-class="opacity-100"
				leave-active-class="transition-opacity duration-150 ease-in"
				leave-from-class="opacity-100"
				leave-to-class="opacity-0"
			>
				<div
					v-if="queryBuilderOpen"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6 backdrop-blur-[1px]"
					@click.self="queryBuilderOpen = false"
				>
					<div class="w-full max-w-3xl">
						<QueryBuilder
							v-model:open="queryBuilderOpen"
							:show-toggle="false"
							:show-apply="true"
							apply-label="Apply"
							transition="fade"
							panel-class=""
							@reset="handleClear"
							@apply="() => { applyQueryBuilderEdits(); queryBuilderOpen = false; }"
						/>
					</div>
				</div>
			</Transition>
		</Teleport>

	</div>
</template>

<style scoped>
.query-marquee {
	width: 100%;
	overflow-x: auto;
	overflow-y: hidden;
	white-space: nowrap;
	scrollbar-width: none;
}
.query-marquee::-webkit-scrollbar {
	display: none;
}
.query-marquee-track {
	display: inline-flex;
	align-items: center;
	gap: 2rem;
}
.query-marquee-track.is-scrolling {
	animation: query-marquee 18s linear infinite;
}
.query-text {
	font-size: 11px;
	font-weight: 500;
	letter-spacing: 0.02em;
	color: hsl(var(--foreground) / 0.75);
	font-family:
		ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
		"Courier New", monospace;
}
.query-value {
	color: hsl(var(--primary));
	font-weight: 600;
	outline: none;
}
.query-scope {
	text-transform: none;
}
.query-value:focus {
	text-decoration: underline;
	text-decoration-thickness: 1px;
	text-underline-offset: 2px;
}
.query-value-invalid {
	color: hsl(var(--destructive));
	text-decoration: underline;
	text-decoration-thickness: 1px;
	text-underline-offset: 2px;
}
@keyframes query-marquee {
	0% {
		transform: translateX(0);
	}
	100% {
		transform: translateX(-50%);
	}
}

/* Drag handle for resizable panels */
.drag-handle {
	width: 5px;
	cursor: col-resize;
	display: flex;
	align-items: stretch;
	justify-content: center;
}
</style>
