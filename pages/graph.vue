<script setup lang="ts">
import {
	ref,
	computed,
	watch,
	onMounted,
	defineAsyncComponent,
} from "vue";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-vue-next";
import AppHeader from "~/components/shared/AppHeader.vue";
import Tooltip from "~/components/ui/tooltip/Tooltip.vue";
import Badge from "~/components/ui/badge/Badge.vue";
import type { Citation } from "~/lib/types";
import { fetchDocumentByEcli } from "~/lib/api/client";

const CitationGraph = defineAsyncComponent(() =>
	import("~/components/shared/CitationGraph.vue"),
);

const route = useRoute();
const router = useRouter();

// ── State ──
const loading = ref(true);
const error = ref<string | null>(null);
const citation = ref<Citation | null>(null);
const citedDocs = ref<Citation[]>([]);
const citesEclis = ref<Set<string>>(new Set());
const citedByEclis = ref<Set<string>>(new Set());

// Navigation history stack (for back navigation through graph exploration)
const navStack = ref<string[]>([]);

const ecli = computed(() => {
	const q = route.query.ecli;
	return typeof q === "string" ? q : Array.isArray(q) ? q[0] || "" : "";
});

const citesCount = computed(() => citesEclis.value.size);
const citedByCount = computed(() => citedByEclis.value.size);

// ── Data fetching ──
async function loadGraph(ecliStr: string) {
	if (!ecliStr) {
		error.value = "No ECLI provided.";
		loading.value = false;
		return;
	}

	loading.value = true;
	error.value = null;
	citation.value = null;

	const result = await fetchDocumentByEcli(ecliStr);

	if (result.error) {
		error.value = result.error;
		loading.value = false;
		return;
	}

	if (!result.citation) {
		error.value = "Document not found.";
		loading.value = false;
		return;
	}

	citation.value = result.citation;
	citedDocs.value = result.citedDocs;
	citesEclis.value = result.citesEclis;
	citedByEclis.value = result.citedByEclis;
	loading.value = false;
}

// ── Navigation ──
function navigateToNode(targetEcli: string) {
	// Push current ecli onto the stack before navigating
	if (ecli.value) {
		navStack.value.push(ecli.value);
	}
	router.push({ path: "/graph", query: { ecli: targetEcli } });
}

function goBack() {
	if (navStack.value.length > 0) {
		const prev = navStack.value.pop()!;
		router.push({ path: "/graph", query: { ecli: prev } });
	} else {
		// Check if there's browser history to go back to
		const historyState = window.history.state;
		if (historyState?.back) {
			router.back();
		} else {
			// Fall back to document page or home
			if (ecli.value) {
				router.push({ path: "/document", query: { ecli: ecli.value } });
			} else {
				router.push("/");
			}
		}
	}
}

function jumpToStackIndex(idx: number) {
	// Navigate to a specific point in the nav stack
	const target = navStack.value[idx];
	if (!target) return;
	// Remove everything from that index onward
	navStack.value.splice(idx);
	router.push({ path: "/graph", query: { ecli: target } });
}

function openDocument() {
	if (!ecli.value) return;
	router.push({ path: "/document", query: { ecli: ecli.value } });
}

// ── Lifecycle ──
onMounted(() => {
	loadGraph(ecli.value);
});

watch(ecli, (newEcli) => {
	loadGraph(newEcli);
});

useHead({
	title: computed(() =>
		citation.value?.title
			? `Graph – ${citation.value.title}`
			: ecli.value
				? `Graph – ${ecli.value}`
				: "Citation Graph",
	),
});
</script>

<template>
	<div class="flex flex-col h-screen">
		<AppHeader fixed />

		<!-- Top bar -->
		<div
			class="fixed top-12 inset-x-0 z-30 bg-background/95 backdrop-blur border-b border-border shrink-0"
		>
			<div class="flex items-center gap-3 px-4 h-10">
				<!-- Back -->
				<Tooltip :text="navStack.length > 0 ? 'Previous graph' : 'Go back'">
					<button
						class="group flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-muted/50"
						@click="goBack"
						aria-label="Go back"
					>
						<ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
					</button>
				</Tooltip>

				<!-- Breadcrumb / nav stack -->
				<div v-if="navStack.length > 0" class="flex items-center gap-1 text-[10px] text-muted-foreground/40 overflow-hidden">
					<template v-for="(prevEcli, i) in navStack.slice(-3)" :key="i">
						<span class="text-muted-foreground/20">›</span>
						<button
							class="truncate max-w-[120px] hover:text-foreground/60 transition-colors"
							@click="jumpToStackIndex(navStack.length - Math.min(3, navStack.length) + i)"
						>
							{{ prevEcli.split(':').slice(-2).join(':') }}
						</button>
					</template>
					<span class="text-muted-foreground/20">›</span>
				</div>

				<!-- Current document info -->
				<div v-if="citation" class="flex items-center gap-2 flex-1 min-w-0">
					<Badge
						:variant="citation.source === 'HUDOC' ? 'default' : 'secondary'"
						class="text-[10px] h-4.5 px-1.5 shrink-0"
					>
						{{ citation.source === "HUDOC" ? "ECHR" : "Rechtspraak" }}
					</Badge>
					<span class="text-xs font-medium text-foreground truncate">
						{{ citation.title || citation.ecli }}
					</span>
					<code class="text-[9px] text-muted-foreground/40 font-mono shrink-0 hidden sm:block">
						{{ citation.ecli }}
					</code>
				</div>
				<div v-else-if="loading" class="flex items-center gap-2 flex-1">
					<Loader2 class="h-3 w-3 animate-spin text-muted-foreground/40" />
					<span class="text-xs text-muted-foreground/40">Loading graph…</span>
				</div>

				<!-- Stats -->
				<div v-if="!loading && citation" class="flex items-center gap-2 shrink-0">
					<span class="text-[9px] text-muted-foreground/40">
						{{ citesCount }} cited · {{ citedByCount }} cited by
					</span>
					<div class="w-px h-4 bg-border/50" />
					<Tooltip text="Open document">
						<button
							class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground hover:bg-muted/50"
							@click="openDocument"
							aria-label="Open document"
						>
							<ExternalLink class="h-3.5 w-3.5" />
						</button>
					</Tooltip>
				</div>
			</div>
		</div>

		<!-- Graph area (full remaining height) -->
		<div class="flex-1 mt-22">
			<!-- Loading -->
			<div v-if="loading" class="flex items-center justify-center h-full">
				<div class="flex flex-col items-center gap-3">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground/30" />
					<p class="text-sm text-muted-foreground/40">Loading citation graph…</p>
				</div>
			</div>

			<!-- Error -->
			<div v-else-if="error" class="flex items-center justify-center h-full">
				<div class="flex flex-col items-center gap-3 text-center px-8">
					<p class="text-sm text-destructive/70">{{ error }}</p>
					<button
						class="text-xs text-primary hover:underline"
						@click="loadGraph(ecli)"
					>
						Try again
					</button>
				</div>
			</div>

			<!-- Graph -->
			<div v-else-if="citation" class="h-full">
				<ClientOnly>
					<CitationGraph
						:root-ecli="ecli"
						:root-citation="citation"
						:cites-eclis="citesEclis"
						:cited-by-eclis="citedByEclis"
						:cited-docs="citedDocs"
						:full-page="true"
						class="h-full"
						@navigate="navigateToNode"
					/>
				</ClientOnly>
			</div>
		</div>
	</div>
</template>
