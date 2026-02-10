<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Scale, ArrowRight, Search } from "lucide-vue-next";
import SmartSearchBar from "~/components/search/SmartSearchBar.vue";
import QueryBuilder from "~/components/search/QueryBuilder.vue";
import SearchHistory from "~/components/shared/SearchHistory.vue";
import AppHeader from "~/components/shared/AppHeader.vue";
import AppFooter from "~/components/shared/AppFooter.vue";
import { useSmartSearch } from "~/composables/useSmartSearch";
import { queryBuilderGroupToSearchQuery } from "~/lib/utils/search-query";
import {
	queryBuilderGroupToParams,
	paramsToQueryBuilderState,
} from "~/lib/utils/query-builder-url";
import { useSearch } from "~/composables/useSearch";
import { useHistory, type HistoryEntry } from "~/composables/useHistory";
import { useUserData } from "~/composables/useUserData";
import { useLibrary } from "~/composables/useLibrary";
import { SEARCH_EXAMPLES } from "~/lib/utils/search-examples";
import { compressSearchParams } from "~/lib/utils/compressed-url";

const route = useRoute();
const router = useRouter();
const store = useSearch();
const history = useHistory();
const smartSearch = useSmartSearch();
const userDataStore = useUserData();
const { libraryOpen, libraryWidth } = useLibrary();
const queryBuilderOpen = ref(false);
const showCompactLogo = computed(() => queryBuilderOpen.value);
const submitError = ref<string | null>(null);
const searchBarResetKey = ref(0);

const exampleSearches = ref<string[]>([]);

function shuffleExamples(list: string[]): string[] {
	const arr = [...list];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function ensureSearchStringFromInput() {
	if (
		!smartSearch.searchString.value &&
		smartSearch.lastEditSource.value === "searchbar" &&
		smartSearch.rawText.value.trim()
	) {
		smartSearch.setSearchString(smartSearch.rawText.value);
	}
}

function navigateToResults() {
	ensureSearchStringFromInput();
	const parsed = queryBuilderGroupToSearchQuery(
		smartSearch.queryBuilderGroup.value,
	);
	if (!parsed.query) {
		submitError.value = parsed.error || "Unable to parse query builder.";
		return;
	}
	submitError.value = null;
	const nextQuery = {
		...parsed.query,
		queryBuilderGroup: smartSearch.queryBuilderGroup.value,
	};
	store.setQuery(nextQuery);
	const includeSearchString = !!smartSearch.searchString.value;
	const rawSearchText = includeSearchString
		? smartSearch.searchString.value
		: "";
	history.add(nextQuery, undefined, rawSearchText);
	if (rawSearchText) userDataStore.logSearch(rawSearchText);
		const params = queryBuilderGroupToParams(
			smartSearch.queryBuilderGroup.value,
			{
				pageSize: nextQuery.pageSize,
				cursor: nextQuery.cursor,
				searchString: includeSearchString
					? smartSearch.searchString.value
					: undefined,
				sortBy: nextQuery.sortBy,
				sortDirection: nextQuery.sortDirection,
				page: nextQuery.page,
			},
		);
	const compressed = compressSearchParams(params);
	router.push({
		path: "/results",
		query: Object.fromEntries(compressed.entries()),
	});
}

function handleSubmit() {
	navigateToResults();
}

function handleClear() {
	store.resetQuery();
	smartSearch.clearAll();
	smartSearch.setFromText("");
	smartSearch.setSearchString("");
	searchBarResetKey.value += 1;
	submitError.value = null;
	router.replace({ path: "/", query: {} });
}

function handleExampleSearch(text: string) {
	smartSearch.setFromText(text);
	smartSearch.setSearchString(text);
	navigateToResults();
}

function handleHistorySelect(entry: HistoryEntry) {
	const entryText = entry?.text?.trim();
	if (entryText) {
		smartSearch.setFromText(entryText);
		smartSearch.setSearchString(entryText);
		navigateToResults();
		return;
	}
	if (entry?.query) {
		smartSearch.setFromSearchQuery(entry.query);
		navigateToResults();
	}
}

onMounted(() => {
	store.resetQuery();
	smartSearch.clearAll();
	submitError.value = null;
	exampleSearches.value = shuffleExamples(SEARCH_EXAMPLES).slice(0, 6);

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(route.query)) {
		if (Array.isArray(value)) params.set(key, value.join(","));
		else if (value) params.set(key, value);
	}
	if ([...params.keys()].length === 0) return;

	const parsed = paramsToQueryBuilderState(params);
	if (!parsed.state) {
		submitError.value = parsed.error || "Invalid URL parameters.";
		return;
	}

	const group = parsed.state.group;
	const result = queryBuilderGroupToSearchQuery(group);
	if (!result.query) {
		submitError.value = result.error || "Unable to parse query builder.";
		return;
	}

	const nextQuery = {
		...result.query,
		pageSize: parsed.state.pageSize || result.query.pageSize,
		cursor: parsed.state.cursor,
		page: parsed.state.page || result.query.page,
		sortBy: parsed.state.sortBy || result.query.sortBy,
		sortDirection: parsed.state.sortDirection || result.query.sortDirection,
	};

	if (parsed.state.searchString) {
		smartSearch.setFromText(parsed.state.searchString);
		smartSearch.onQueryBuilderEdit(group);
		smartSearch.setSearchString(parsed.state.searchString);
	} else {
		smartSearch.setFromText("");
		smartSearch.onQueryBuilderEdit(group);
		smartSearch.setSearchString("");
	}
	store.setQuery({ ...nextQuery, queryBuilderGroup: group });
	submitError.value = null;
});
</script>

<template>
	<div
		class="relative h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/30"
	>
		<div class="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
			<div
				class="absolute inset-0 opacity-60 dark:hidden"
				style="
					background-image: radial-gradient(
						rgba(15, 23, 42, 0.2) 1.2px,
						transparent 1px
					);
					background-size: 18px 18px;
					mask-image: radial-gradient(
						circle at center,
						transparent 0%,
						transparent 20%,
						black 40%,
						black 100%
					);
					mask-position: center;
					mask-repeat: no-repeat;
					-webkit-mask-image: radial-gradient(
						circle at center,
						transparent 0%,
						transparent 20%,
						black 40%,
						black 100%
					);
					-webkit-mask-position: center;
					-webkit-mask-repeat: no-repeat;
				"
			/>
			<div
				class="absolute inset-0 hidden opacity-50 dark:block"
				style="
					background-image: radial-gradient(
						rgba(248, 250, 252, 0.2) 1.2px,
						transparent 1px
					);
					background-size: 18px 18px;
					mask-image: radial-gradient(
						circle at center,
						transparent 0%,
						transparent 20%,
						black 40%,
						black 100%
					);
					mask-position: center;
					mask-repeat: no-repeat;
					-webkit-mask-image: radial-gradient(
						circle at center,
						transparent 0%,
						transparent 20%,
						black 40%,
						black 100%
					);
					-webkit-mask-position: center;
					-webkit-mask-repeat: no-repeat;
				"
			/>
		</div>
		<div class="relative z-50 pointer-events-auto">
			<AppHeader fixed />
		</div>
		<div
			class="fixed top-14 z-30 transition-[left] duration-200"
			:style="{ left: libraryOpen ? (libraryWidth + 5 + 20) + 'px' : '20px' }"
		>
			<span
				class="inline-flex items-center rounded-lg bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border"
			>
				Preview
			</span>
		</div>

		<!-- Scrollable middle -->
		<main class="relative z-10 h-full overflow-y-auto px-6 pt-20 pb-20">
			<div
				class="mx-auto flex min-h-[calc(100vh-10rem)] max-w-[680px] flex-col justify-center space-y-10"
			>
				<!-- Logo & Title -->
				<div
					class="text-center space-y-4 overflow-hidden transition-all duration-300 ease-out"
					:class="
						showCompactLogo
							? 'max-h-0 opacity-0 -translate-y-2 pointer-events-none'
							: 'max-h-[320px] opacity-100 translate-y-0'
					"
				>
					<div
						class="inline-flex items-center justify-center rounded-2xl bg-primary/5 p-4 mb-2"
					>
						<Scale class="h-12 w-12 text-primary" />
					</div>
					<h1 class="text-5xl font-bold tracking-tight text-foreground">
						Legal<span class="text-primary/70">Search</span>
					</h1>
					<p
						class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed"
					>
						Search across ECHR and Rechtspraak case law with smart query parsing
					</p>
				</div>

				<!-- Smart search bar -->
				<div class="space-y-4">
					<SmartSearchBar
						:key="searchBarResetKey"
						:loading="store.loading.value"
						size="large"
						:autofocus="false"
						:chips="false"
						@submit="handleSubmit"
						@clear="handleClear"
					/>

					<!-- Query builder toggle -->
					<div class="flex justify-center">
						<QueryBuilder
							v-model:open="queryBuilderOpen"
							@reset="handleClear"
						/>
					</div>
					<p v-if="submitError" class="text-xs text-destructive text-center">
						{{ submitError }}
					</p>
				</div>

				<!-- Search history -->
				<SearchHistory @select="handleHistorySelect" />

				<!-- Example searches -->
				<div class="space-y-4">
					<div class="flex items-center justify-center gap-2">
						<div class="h-px flex-1 bg-border/50" />
						<span
							class="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-3"
							>Try searching</span
						>
						<div class="h-px flex-1 bg-border/50" />
					</div>
					<div class="grid grid-cols-2 gap-2">
						<button
							v-for="example in exampleSearches"
							:key="example"
							class="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground hover:border-primary/20 hover:bg-accent/50 hover:shadow-sm transition-all"
							@click="handleExampleSearch(example)"
						>
							<Search
								class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors"
							/>
							<span class="truncate">{{ example }}</span>
							<ArrowRight
								class="h-3.5 w-3.5 ml-auto shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
							/>
						</button>
					</div>
				</div>
			</div>
		</main>

		<AppFooter />
	</div>
</template>
