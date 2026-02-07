<script setup lang="ts">
import {
	ref,
	computed,
	onMounted,
	onBeforeUnmount,
	watch,
	nextTick,
} from "vue";
import {
	Loader2,
	AlertCircle,
	Filter,
	Brackets,
	ArrowLeft,
	X,
} from "lucide-vue-next";
import AppHeader from "~/components/shared/AppHeader.vue";
import AppFooter from "~/components/shared/AppFooter.vue";
import QueryBuilder from "~/components/search/QueryBuilder.vue";
import ResultList from "~/components/results/ResultList.vue";
import ResultFilters from "~/components/results/ResultFilters.vue";
import ResultDetail from "~/components/results/ResultDetail.vue";
import ResultStats from "~/components/results/ResultStats.vue";
import ResultSort from "~/components/results/ResultSort.vue";
import BulkActions from "~/components/results/BulkActions.vue";
import Button from "~/components/ui/button/Button.vue";
import { useSmartSearch } from "~/composables/useSmartSearch";
import { useSearch } from "~/composables/useSearch";
import { useHistory } from "~/composables/useHistory";
import type { Citation, SearchQuery, QueryBuilderGroup } from "~/lib/types";
import {
	queryBuilderGroupToSearchQuery,
	searchQueryToQueryBuilderGroup,
} from "~/lib/utils/search-query";
import {
	paramsToQueryBuilderState,
	queryBuilderGroupToParams,
} from "~/lib/utils/query-builder-url";
import { summarizeQueryBuilder } from "~/lib/utils/query-summary";
import { parseNaturalLanguageToQueryBuilderGroup } from "~/lib/parser/nl-query-parser";

const route = useRoute();
const router = useRouter();
const store = useSearch();
const history = useHistory();
const smartSearch = useSmartSearch();

const viewMode = ref<"compact" | "expanded">("expanded");
const filtersCollapsed = ref(false);
const routeError = ref<string | null>(null);
const syncingRoute = ref(false);
const syncingSmartSearch = ref(false);
const queryBuilderOpen = ref(false);
const summaryText = computed(() =>
	summarizeQueryBuilder(smartSearch.queryBuilderGroup.value),
);
const marqueeRef = ref<HTMLElement | null>(null);
const shouldScroll = ref(false);
let marqueeObserver: ResizeObserver | null = null;

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
	group?: QueryBuilderGroup,
) {
	store.setQuery({
		...query,
		page: query.page || 1,
		queryBuilderGroup: group || smartSearch.queryBuilderGroup.value,
	});
	store.search();
	if (updateUrl) {
		const includeSearchString =
			smartSearch.lastEditSource.value === "searchbar" &&
			!!smartSearch.searchString.value;
		const params = queryBuilderGroupToParams(
			group || smartSearch.queryBuilderGroup.value,
			{
				pageSize: query.pageSize,
				cursor: query.cursor,
				searchString: includeSearchString
					? smartSearch.searchString.value
					: undefined,
			},
		);
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

function handleInvalidRoute(error: string) {
	routeError.value = error;
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
	const shouldNormalize = !params.has("qb");

	if ([...params.keys()].length === 0) {
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
			const nextQuery: SearchQuery = {
				...searchResult.query,
				pageSize: searchResult.query.pageSize,
				cursor: undefined,
				page: 1,
			};
			routeError.value = null;
			syncingSmartSearch.value = true;
			smartSearch.setFromText(searchString);
			smartSearch.setSearchString(searchString);
			smartSearch.queryBuilderGroup.value = group;
			smartSearch.lastEditSource.value = "searchbar";
			nextTick(() => {
				syncingSmartSearch.value = false;
			});
			store.resetPagination();
			applyQueryAndSearch(nextQuery, true, group);
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

	const nextQuery: SearchQuery = {
		...searchResult.query,
		pageSize: parsed.state.pageSize || searchResult.query.pageSize,
		cursor: parsed.state.cursor,
		page: 1,
	};

	routeError.value = null;
	syncingSmartSearch.value = true;
	if (parsed.state.searchString) {
		smartSearch.setFromText(parsed.state.searchString);
		smartSearch.setSearchString(parsed.state.searchString);
		smartSearch.queryBuilderGroup.value = group;
		smartSearch.lastEditSource.value = "searchbar";
	} else {
		smartSearch.setFromSearchQuery(nextQuery);
		smartSearch.setSearchString("");
		smartSearch.onQueryBuilderEdit(group);
	}
	nextTick(() => {
		syncingSmartSearch.value = false;
	});
	store.resetPagination();
	applyQueryAndSearch(nextQuery, shouldNormalize, group);
}

onMounted(() => {
	applyRouteQuery();
	nextTick(updateMarquee);
	if (typeof ResizeObserver !== "undefined") {
		marqueeObserver = new ResizeObserver(() => updateMarquee());
		if (marqueeRef.value) marqueeObserver.observe(marqueeRef.value);
	}
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
	() => smartSearch.queryBuilderGroup.value,
	() => {
		if (syncingSmartSearch.value) return;
		if (smartSearch.lastEditSource.value !== "querybuilder") return;

		const parsed = queryBuilderGroupToSearchQuery(
			smartSearch.queryBuilderGroup.value,
		);
		if (!parsed.query) {
			handleInvalidRoute(parsed.error || "Unable to parse query builder.");
			return;
		}
		routeError.value = null;
		store.resetPagination();
		applyQueryAndSearch(
			{ ...parsed.query, page: 1, cursor: undefined },
			true,
			smartSearch.queryBuilderGroup.value,
		);
	},
	{ deep: true },
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
	store.resetPagination();
	applyQueryAndSearch(
		{ ...parsed.query, page: 1, cursor: undefined },
		true,
		smartSearch.queryBuilderGroup.value,
	);
	const includeSearchString =
		smartSearch.lastEditSource.value === "searchbar" &&
		!!smartSearch.searchString.value;
	const rawSearchText = includeSearchString
		? smartSearch.searchString.value
		: "";
	history.add(store.query.value, store.results.value?.total, rawSearchText);
}

function handleEditSearch() {
	const includeSearchString =
		smartSearch.lastEditSource.value === "searchbar" &&
		!!smartSearch.searchString.value;
	const params = queryBuilderGroupToParams(
		smartSearch.queryBuilderGroup.value,
		{
			pageSize: store.query.value.pageSize,
			searchString: includeSearchString
				? smartSearch.searchString.value
				: undefined,
		},
	);
	router.push({ path: "/", query: Object.fromEntries(params.entries()) });
}

function handleFilterChange(partial: Partial<SearchQuery>) {
	store.resetPagination();
	const next = { ...store.query.value, ...partial, page: 1, cursor: undefined };
	const group = searchQueryToQueryBuilderGroup(next);
	smartSearch.onQueryBuilderEdit(group);
	applyQueryAndSearch(next, true, group);
}

function handlePageChange(page: number) {
	const cursor = store.cursorHistory.value[page];
	if (page > 1 && !cursor) return;
	applyQueryAndSearch(
		{ ...store.query.value, page, cursor },
		true,
		smartSearch.queryBuilderGroup.value,
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
						<div class="flex flex-row h-full justify-between w-full mx-auto">
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
										v-if="summaryText"
										ref="marqueeRef"
										class="query-marquee"
										:title="summaryText"
									>
										<div
											:class="[
												'query-marquee-track',
												shouldScroll ? 'is-scrolling' : '',
											]"
										>
											<span class="query-text">{{ summaryText }}</span>
											<span
												v-if="shouldScroll"
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
				<div class="mx-auto flex w-full min-h-0 flex-1 gap-0 px-0">
					<!-- Left sidebar: Filters -->
					<aside
						v-if="store.results.value && !filtersCollapsed"
						class="shrink-0 border-r border-border pt-4 pr-0 pb-0 pl-0 h-full overflow-hidden w-72"
					>
						<ResultFilters
							:facets="store.results.value.facets"
							:query="store.query.value"
							@change="handleFilterChange"
							@toggle-collapse="filtersCollapsed = true"
						/>
					</aside>

					<!-- Center: Results -->
					<section
						class="flex min-h-0 flex-1 flex-col pt-6 pr-6 pb-0 pl-6 min-w-0"
					>
						<!-- Loading -->
						<div
							v-if="store.loading.value"
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
							<div class="text-center space-y-3 max-w-md">
								<AlertCircle class="h-8 w-8 text-red-500 mx-auto" />
								<p class="text-sm font-medium text-foreground">Search failed</p>
								<p class="text-xs text-muted-foreground">
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
							class="flex min-h-0 flex-1 flex-col gap-4"
						>
							<!-- Stats -->
							<ResultStats
								:total="store.results.value.total"
								:total-is-exact="store.results.value.totalIsExact"
								:has-more="!!store.results.value.nextCursor"
								:loading-more="store.results.value.loadingMore"
								:ai-summary="store.results.value.aiSummary"
								:did-you-mean="store.results.value.didYouMean"
								@did-you-mean="handleDidYouMean"
							>
								<template #countPrefix>
									<Button
										variant="outline"
										size="sm"
										class="h-7 gap-1.5"
										@click="filtersCollapsed = !filtersCollapsed"
									>
										<Filter class="h-3.5 w-3.5" />
										Filters
									</Button>
								</template>
							</ResultStats>

							<!-- Sort & bulk actions row -->
							<div class="flex items-center justify-between gap-4">
								<ResultSort
									:sort-by="store.query.value.sortBy"
									:sort-direction="store.query.value.sortDirection"
									:view-mode="viewMode"
									@change="
										(sortBy: string, dir: string) => {
											store.resetPagination();
											applyQueryAndSearch(
												{
													...store.query.value,
													sortBy: sortBy as
														| 'relevance'
														| 'date'
														| 'citations'
														| 'importance',
													sortDirection: dir as 'asc' | 'desc',
													page: 1,
													cursor: undefined,
												},
												true,
											);
										}
									"
									@view-change="(mode) => (viewMode = mode)"
								/>
								<BulkActions
									:selected-count="store.selectedCount.value"
									:total-count="store.results.value.results.length"
									@select-all="store.selectAll()"
									@clear="store.clearSelection()"
									@export="(format) => store.exportSelected(format)"
								/>
							</div>

							<!-- Results list -->
							<div class="min-h-0 flex-1 overflow-y-auto pr-0 pb-16">
								<ResultList
									:results="store.results.value.results"
									:query="store.query.value.text"
									:selected-result-id="store.selectedResult.value?.id"
									:selected-ids="store.selectedIds.value"
									:page="store.query.value.page"
									:total-pages="store.totalPages.value || undefined"
									:has-next="!!store.results.value.nextCursor"
									:estimated-total-pages="estimatedTotalPages || undefined"
									:total-is-exact="store.results.value.totalIsExact"
									@select="handleSelectResult"
									@toggle="(id) => store.toggleSelection(id)"
									@page="handlePageChange"
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
							transition="fade"
							panel-class=""
							@reset="handleClear"
						/>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- Detail panel -->
		<ResultDetail
			:citation="store.selectedResult.value"
			:open="store.detailOpen.value"
			@close="store.closeDetail()"
			@find-similar="handleFindSimilar"
		/>
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
@keyframes query-marquee {
	0% {
		transform: translateX(0);
	}
	100% {
		transform: translateX(-50%);
	}
}
</style>
