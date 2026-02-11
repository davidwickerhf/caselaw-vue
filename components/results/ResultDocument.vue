<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from "vue";
import {
	ExternalLink,
	Star,
	Calendar,
	MapPin,
	FileText,
	Tag,
	Scale,
	Copy,
	Check,
	X,
	ChevronDown,
	ChevronUp,
	Loader2,
	Globe,
	Hash,
	Gavel,
	Link2,
	Link,
	Bookmark,
	Maximize2,
	GitFork,
	FolderInput,
	Folder,
} from "lucide-vue-next";
import Badge from "~/components/ui/badge/Badge.vue";
import Button from "~/components/ui/button/Button.vue";
import Tooltip from "~/components/ui/tooltip/Tooltip.vue";
import type { Citation } from "~/lib/types";
import { formatDate } from "~/lib/utils/utils";
import {
	fetchExpandNode,
	fetchDocumentFullText,
	type EchrLanguageEntry,
} from "~/lib/api/client";
import { useUserData } from "~/composables/useUserData";

const CitationGraph = defineAsyncComponent(() =>
	import("~/components/shared/CitationGraph.vue"),
);

const props = defineProps<{
	citation: Citation | null;
}>();

const emit = defineEmits<{
	close: [];
	findSimilar: [citation: Citation];
	selectCitation: [citation: Citation];
}>();

const router = useRouter();
const userData = useUserData();
const isSaved = computed(() => props.citation ? userData.isDocSaved(props.citation.ecli) : false);

const copied = ref(false);
const linkCopied = ref(false);
const fullTextExpanded = ref(false);
const graphExpanded = ref(false);
const citedDocs = ref<Citation[]>([]);
const citedLoading = ref(false);
const citedError = ref<string | null>(null);
const citedLoaded = ref(false);
// Edge-derived citation sets (populated from expand endpoint)
const expandCitesEclis = ref<Set<string>>(new Set());
const expandCitedByEclis = ref<Set<string>>(new Set());

// Full text fetching state
const fetchedFullText = ref<string | null>(null);
const fullTextLoading = ref(false);
const fullTextError = ref<string | null>(null);
const fullTextLoaded = ref(false);
const fullTextLanguage = ref<string | null>(null);
const selectedLanguage = ref<string | null>(null);
// All languages map from the ECHR endpoint (allows client-side switching)
const languagesMap = ref<Record<string, EchrLanguageEntry> | null>(null);
let fullTextAbort: AbortController | null = null;

// Available languages: only those that actually have full text
const availableLanguages = computed(() => {
	if (languagesMap.value) {
		return Object.keys(languagesMap.value).filter(
			(lang) => languagesMap.value![lang].full_text_available,
		);
	}
	return [];
});

const isEchr = computed(() => props.citation?.source === "HUDOC");

const LANGUAGE_LABELS: Record<string, string> = {
	ENG: "English",
	FRE: "French",
	GER: "German",
	ITA: "Italian",
	SPA: "Spanish",
	RUS: "Russian",
	TUR: "Turkish",
	UKR: "Ukrainian",
	ROM: "Romanian",
	ARM: "Armenian",
	AZE: "Azerbaijani",
	BOS: "Bosnian",
	BUL: "Bulgarian",
	CAT: "Catalan",
	CZE: "Czech",
	DUT: "Dutch",
	EST: "Estonian",
	FIN: "Finnish",
	GEO: "Georgian",
	GRE: "Greek",
	HUN: "Hungarian",
	LAV: "Latvian",
	LIT: "Lithuanian",
	MAC: "Macedonian",
	MLT: "Maltese",
	MOL: "Moldovan",
	MON: "Montenegrin",
	NOR: "Norwegian",
	POL: "Polish",
	POR: "Portuguese",
	SCR: "Serbian",
	SLO: "Slovak",
	SLV: "Slovenian",
	SWE: "Swedish",
	ALB: "Albanian",
};

function getLanguageLabel(code: string) {
	return LANGUAGE_LABELS[code] || code;
}

function copyEcli() {
	if (!props.citation) return;
	navigator.clipboard.writeText(props.citation.ecli);
	copied.value = true;
	setTimeout(() => (copied.value = false), 2000);
}

function openOriginalDocument() {
	if (!props.citation?.url_publication) return;
	if (typeof window === "undefined") return;
	window.open(props.citation.url_publication, "_blank");
}

function getDocumentUrl(includeFrom = false) {
	if (!props.citation) return "";
	let url = `/document?ecli=${encodeURIComponent(props.citation.ecli)}`;
	if (includeFrom && typeof window !== "undefined") {
		// Pass current results URL so the document page can navigate back to it
		url += `&from=${encodeURIComponent(window.location.pathname + window.location.search)}`;
	}
	return url;
}

function openDocumentPage() {
	if (!props.citation) return;
	router.push(getDocumentUrl(true));
}

function copyDocumentLink() {
	if (!props.citation || typeof window === "undefined") return;
	const fullUrl = `${window.location.origin}${getDocumentUrl()}`;
	navigator.clipboard.writeText(fullUrl);
	linkCopied.value = true;
	setTimeout(() => (linkCopied.value = false), 2000);
}

const date = computed(
	() => props.citation?.date || props.citation?.date_judgment || "",
);
const importanceLabel = computed(() =>
	props.citation?.importance === 1
		? "Key case"
		: props.citation?.importance === 2
			? "Important"
			: props.citation?.importance === 3
				? "Moderate"
				: props.citation?.importance === 4
					? "Low importance"
					: "",
);

/**
 * Fix missing spaces after punctuation (stripped in the database).
 * Adds a space after `.`, `;`, `,`, `:`, `!`, `?`, `)` when directly
 * followed by a letter or digit, without breaking abbreviations like "Art.6".
 */
function fixPunctuation(text: string): string {
	return text
		.replace(/([.])([A-Za-z])/g, "$1 $2") // period + letter
		.replace(/([;:!?])([A-Za-z0-9(])/g, "$1 $2") // ; : ! ? + alphanum or (
		.replace(/([,])([A-Za-z(])/g, "$1 $2") // comma + letter or (
		.replace(/(\))([A-Za-z0-9(])/g, "$1 $2"); // ) + alphanum or (
}

/**
 * Strip the title from the beginning of the text if it's repeated there.
 */
function stripLeadingTitle(text: string, title: string | undefined): string {
	if (!title) return text;
	const trimmedTitle = title.trim();
	if (!trimmedTitle) return text;
	const trimmedText = text.trimStart();
	if (trimmedText.startsWith(trimmedTitle)) {
		return trimmedText
			.slice(trimmedTitle.length)
			.replace(/^[\s\n\-–—:]+/, "")
			.trimStart();
	}
	return text;
}

// Inline text from search results (headnote/conclusion/summary)
const inlineTextContent = computed(() => {
	if (!props.citation) return "";
	const parts: string[] = [];
	if (props.citation.headnote) parts.push(props.citation.headnote);
	if (
		props.citation.conclusion &&
		props.citation.conclusion !== props.citation.headnote
	) {
		parts.push(props.citation.conclusion);
	}
	if (props.citation.summary && !parts.includes(props.citation.summary)) {
		parts.push(props.citation.summary);
	}
	let text = parts.join("\n\n");
	text = stripLeadingTitle(text, props.citation.title);
	text = fixPunctuation(text);
	return text.trim();
});

// Full text: only from the API, no fallback to summary
const fullTextContent = computed(() => fetchedFullText.value || "");

async function loadFullText() {
	if (!props.citation) return;
	fullTextLoading.value = true;
	fullTextError.value = null;

	// Abort any previous fetch
	if (fullTextAbort) fullTextAbort.abort();
	fullTextAbort = new AbortController();

	try {
		const result = await fetchDocumentFullText(
			props.citation.ecli,
			props.citation.source as "HUDOC" | "Rechtspraak",
			{ signal: fullTextAbort.signal },
		);
		if (result.error) {
			fullTextError.value = result.error;
		}

		// Store the languages map for client-side switching (ECHR)
		if (result.languages) {
			languagesMap.value = result.languages;
		}

		// Set the active language and text
		const lang = result.defaultLanguage || result.language || null;
		fullTextLanguage.value = lang;
		selectedLanguage.value = lang;
		fetchedFullText.value = result.fullText;

		fullTextLoaded.value = true;
	} catch (err) {
		if ((err as Error).name === "AbortError") return;
		fullTextError.value =
			err instanceof Error ? err.message : "Failed to fetch full text";
	} finally {
		fullTextLoading.value = false;
	}
}

function switchLanguage(lang: string) {
	if (lang === selectedLanguage.value) return;
	selectedLanguage.value = lang;
	fullTextLanguage.value = lang;

	// Read from the cached languages map (no re-fetch needed)
	if (languagesMap.value && languagesMap.value[lang]) {
		const entry = languagesMap.value[lang];
		fetchedFullText.value =
			entry.full_text_available && typeof entry.full_text === "string"
				? entry.full_text
				: null;
	} else {
		fetchedFullText.value = null;
	}
}

function toggleFullText() {
	fullTextExpanded.value = !fullTextExpanded.value;
}

// --- Citation section computed helpers ---
const hasCitesSection = computed(() => {
	if (!props.citation) return false;
	return (
		(props.citation.cites?.length ?? 0) > 0 || (props.citation.nCiting ?? 0) > 0
	);
});
const hasCitedBySection = computed(() => {
	if (!props.citation) return false;
	return (
		(props.citation.cited_by?.length ?? 0) > 0 ||
		(props.citation.nCited ?? 0) > 0
	);
});

const citedByCount = computed(() => {
	if (expandCitedByEclis.value.size > 0) return expandCitedByEclis.value.size;
	if (props.citation?.cited_by?.length) return props.citation.cited_by.length;
	return props.citation?.nCited ?? 0;
});
const citesCount = computed(() => {
	if (expandCitesEclis.value.size > 0) return expandCitesEclis.value.size;
	if (props.citation?.cites?.length) return props.citation.cites.length;
	return props.citation?.nCiting ?? 0;
});

// Filtered lists for each section
const citesDocsList = computed(() => {
	if (citedDocs.value.length === 0) return [];
	if (expandCitesEclis.value.size > 0) {
		return citedDocs.value.filter((d) => expandCitesEclis.value.has(d.ecli));
	}
	if (props.citation?.cites?.length) {
		return citedDocs.value.filter((d) =>
			props.citation!.cites!.includes(d.ecli),
		);
	}
	return [];
});
const citedByDocsList = computed(() => {
	if (citedDocs.value.length === 0) return [];
	if (expandCitedByEclis.value.size > 0) {
		return citedDocs.value.filter((d) => expandCitedByEclis.value.has(d.ecli));
	}
	if (props.citation?.cited_by?.length) {
		return citedDocs.value.filter((d) =>
			props.citation!.cited_by!.includes(d.ecli),
		);
	}
	return [];
});

// Separate expand toggles
const citesExpanded = ref(false);
const citedByExpanded = ref(false);

async function loadCitedDocuments() {
	if (!props.citation || citedLoaded.value) return;
	citedLoading.value = true;
	citedError.value = null;
	try {
		const dataset = props.citation.source === "HUDOC" ? "ECHR" : "RS";
		const nodeEcli = props.citation.ecli;
		const result = await fetchExpandNode(nodeEcli, {
			degreesSource: 1,
			degreesTarget: 1,
			nodeDataset: dataset,
		});

		// Derive cites/cited_by from edges
		// Edge: source → target means "source cites target"
		// So: source === nodeEcli → this document cites the target (outgoing)
		//     target === nodeEcli → the source cites this document (incoming = cited by)
		const citesSet = new Set<string>();
		const citedBySet = new Set<string>();
		for (const edge of result.edges) {
			if (edge.source === nodeEcli) {
				citesSet.add(edge.target);
			}
			if (edge.target === nodeEcli) {
				citedBySet.add(edge.source);
			}
		}
		expandCitesEclis.value = citesSet;
		expandCitedByEclis.value = citedBySet;

		// Transform expanded nodes to Citations (they come as ApiNode)
		citedDocs.value = result.expandedNodes.map((node) => {
			const d = node.data as Record<string, unknown>;
			const ecli = (d.ecli as string) || node.id;
			const ds = (d.dataset as string) || "";
			const isEchr = ds === "ECHR" || ds === "echr";
			return {
				id: ecli,
				ecli,
				year: 0,
				summary: (d.summary as string) || (d.headnote as string) || "",
				instance: (d.instance as string) || "",
				domain: "",
				domains: [],
				nCited: 0,
				nCiting: 0,
				topics: "",
				document_type: (d.document_type as string) || "",
				procedure_type: "",
				url_publication: (d.url_publication as string) || "",
				source: isEchr ? "HUDOC" : "Rechtspraak",
				languages: Array.isArray(d.languages) ? d.languages as string[] : (isEchr ? [] : ['NLD']),
				title: (d.title as string) || (d.headnote as string) || undefined,
				respondent_state: d.respondent_state as string | undefined,
				date:
					(d.date_judgment as string) ||
					(d.date_decision as string) ||
					undefined,
			} as Citation;
		});
		citedLoaded.value = true;
	} catch (err) {
		citedError.value =
			err instanceof Error ? err.message : "Failed to load citations";
	} finally {
		citedLoading.value = false;
	}
}

function ensureCitedLoaded() {
	if (!citedLoaded.value && !citedLoading.value) {
		loadCitedDocuments();
	}
}

function toggleCites() {
	citesExpanded.value = !citesExpanded.value;
	if (citesExpanded.value) ensureCitedLoaded();
}

function toggleCitedBy() {
	citedByExpanded.value = !citedByExpanded.value;
	if (citedByExpanded.value) ensureCitedLoaded();
}

function toggleGraph() {
	graphExpanded.value = !graphExpanded.value;
	if (graphExpanded.value) ensureCitedLoaded();
}

function openGraphPage() {
	if (!props.citation) return;
	router.push({ path: "/graph", query: { ecli: props.citation.ecli } });
}

// ── Folder picker ──
const folderPickerOpen = ref(false);

function addToFolder(folderId: string) {
	if (!props.citation) return;
	if (!userData.isDocSaved(props.citation.ecli)) {
		userData.toggleSaveDocument(props.citation);
	}
	userData.addDocumentToFolder(props.citation.ecli, folderId);
	folderPickerOpen.value = false;
}

// Reset state when citation changes and immediately fetch full text in background
watch(
	() => props.citation?.ecli,
	(newEcli, oldEcli) => {
		// Skip reset on initial mount (no old value to clean up)
		if (oldEcli) {
			fullTextExpanded.value = false;
			graphExpanded.value = false;
			citesExpanded.value = false;
			citedByExpanded.value = false;
			folderPickerOpen.value = false;
			citedDocs.value = [];
			citedLoading.value = false;
			citedError.value = null;
			citedLoaded.value = false;
			expandCitesEclis.value = new Set();
			expandCitedByEclis.value = new Set();
			// Reset full text state
			if (fullTextAbort) fullTextAbort.abort();
			fetchedFullText.value = null;
			fullTextLoading.value = false;
			fullTextError.value = null;
			fullTextLoaded.value = false;
			fullTextLanguage.value = null;
			selectedLanguage.value = null;
			languagesMap.value = null;
		}
		// Fetch full text in the background as soon as the document opens
		if (newEcli && props.citation) {
			loadFullText();
			// Track document view
			userData.trackDocumentView(props.citation);
		}
	},
	{ immediate: true },
);

// Metadata items as computed for clean rendering
const metadataItems = computed(() => {
	if (!props.citation) return [];
	const c = props.citation;
	const items: Array<{ label: string; value: string; icon: typeof Calendar }> =
		[];

	if (date.value)
		items.push({
			label: "Date",
			value: formatDate(date.value),
			icon: Calendar,
		});
	if (c.respondent_state)
		items.push({
			label: "Respondent State",
			value: c.respondent_state,
			icon: MapPin,
		});
	if (c.document_type)
		items.push({
			label: "Document Type",
			value: c.document_type,
			icon: FileText,
		});
	if (c.instance)
		items.push({ label: "Court Instance", value: c.instance, icon: Scale });
	if (c.domain) items.push({ label: "Domain", value: c.domain, icon: Tag });
	if (c.languages && c.languages.length > 0)
		items.push({ label: "Languages", value: c.languages.join(', '), icon: Globe });
	if (c.originating_body)
		items.push({ label: "Originating Body", value: c.originating_body, icon: Scale });
	if (c.application_number)
		items.push({
			label: "Application No.",
			value: c.application_number,
			icon: Hash,
		});
	if (c.procedure_type)
		items.push({
			label: "Procedure Type",
			value: c.procedure_type,
			icon: Gavel,
		});

	return items;
});
</script>

<template>
	<div v-if="citation" class="h-full flex flex-col">
		<!-- Sticky document header -->
		<div class="shrink-0 sticky top-0 z-10 bg-background doc-header-shadow">
			<!-- Top bar: meta pills + action icons -->
			<div class="flex items-center gap-2 pl-5 pr-2 pt-5 pb-0">
				<Badge
					:variant="citation.source === 'HUDOC' ? 'default' : 'secondary'"
					class="text-[10px] h-5 px-1.5"
				>
					{{ citation.source === "HUDOC" ? "ECHR" : "Rechtspraak" }}
				</Badge>
				<span
					v-if="importanceLabel"
					class="inline-flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400"
				>
					<Star class="h-2.5 w-2.5 fill-current" />
					{{ importanceLabel }}
				</span>
				<span
					v-if="citation.document_type"
					class="text-[10px] uppercase tracking-wider text-muted-foreground/50"
				>
					{{ citation.document_type }}
				</span>

				<!-- Spacer -->
				<div class="flex-1" />

				<!-- Secondary action icons -->
				<Tooltip v-if="citation.url_publication" text="View original source">
					<button
						class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground hover:bg-muted/50"
						@click="openOriginalDocument"
						aria-label="View original source"
					>
						<Globe class="h-3.5 w-3.5" />
					</button>
				</Tooltip>
				<Tooltip text="Copy document link">
					<button
						class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground hover:bg-muted/50"
						@click="copyDocumentLink"
						aria-label="Copy document link"
					>
						<Check v-if="linkCopied" class="h-3.5 w-3.5 text-emerald-500" />
						<Link class="h-3.5 w-3.5" v-else />
					</button>
				</Tooltip>
				<Tooltip text="Citation graph">
					<button
						class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground hover:bg-muted/50"
						@click="openGraphPage"
						aria-label="Open citation graph"
					>
						<GitFork class="h-3.5 w-3.5" />
					</button>
				</Tooltip>
				<Tooltip :text="isSaved ? 'Unsave document' : 'Save document'">
					<button
						:class="[
							'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
							isSaved
								? 'text-primary bg-primary/10'
								: 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/50',
						]"
						@click="citation && userData.toggleSaveDocument(citation)"
						:aria-label="isSaved ? 'Unsave document' : 'Save document'"
					>
						<Bookmark :class="['h-3.5 w-3.5', isSaved ? 'fill-current' : '']" />
					</button>
				</Tooltip>
				<!-- Folder picker -->
				<div class="relative">
					<Tooltip text="Add to folder">
						<button
							:class="[
								'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
								folderPickerOpen
									? 'text-primary bg-primary/10'
									: 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/50',
							]"
							@click="folderPickerOpen = !folderPickerOpen"
							aria-label="Add to folder"
						>
							<FolderInput class="h-3.5 w-3.5" />
						</button>
					</Tooltip>
					<div v-if="folderPickerOpen" class="fixed inset-0 z-20" @click="folderPickerOpen = false" />
					<div
						v-if="folderPickerOpen"
						class="absolute right-0 top-9 z-30 w-48 rounded-lg border border-border/80 bg-popover shadow-xl py-1"
					>
						<div class="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Add to folder</div>
						<template v-if="userData.folders.value.length > 0">
							<button
								v-for="folder in userData.folders.value"
								:key="folder.id"
								class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors"
								@click="addToFolder(folder.id)"
							>
								<Folder class="h-3 w-3 text-muted-foreground/50" />
								<span class="truncate flex-1">{{ folder.name }}</span>
								<Check
									v-if="userData.getDocsInFolder(folder.id).some((d) => d.ecli === citation!.ecli)"
									class="h-3 w-3 text-primary shrink-0"
								/>
							</button>
						</template>
						<div v-else class="px-3 py-2 text-[10px] text-muted-foreground/50">
							No folders yet. Create one in the Library.
						</div>
					</div>
				</div>
				<div class="w-px h-4 bg-border/60 mx-0.5" />
				<button
					class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-muted/50"
					@click="emit('close')"
					title="Close"
					aria-label="Close"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>

			<!-- Title + ECLI -->
			<div class="pl-5 pr-3 pt-2.5 pb-2">
				<h2 class="text-[15px] font-semibold leading-snug text-foreground line-clamp-2">
					{{ citation.title || citation.ecli }}
				</h2>
				<div class="flex items-center gap-1.5 mt-1.5">
					<code class="text-[10px] text-muted-foreground/60 font-mono leading-none">{{
						citation.ecli
					}}</code>
					<button
						class="shrink-0 text-muted-foreground/30 transition-colors hover:text-foreground"
						@click="copyEcli"
						title="Copy ECLI"
						aria-label="Copy ECLI"
					>
						<Check v-if="copied" class="h-2.5 w-2.5 text-emerald-500" />
						<Copy v-else class="h-2.5 w-2.5" />
					</button>
				</div>
			</div>

			<!-- Open document button (prominent) -->
			<div class="px-5 pb-3.5">
				<button
					class="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
					@click="openDocumentPage"
				>
					<ExternalLink class="h-3 w-3" />
					Open document
				</button>
			</div>
			<div class="h-px bg-border" />
		</div>

		<!-- Scrollable content -->
		<div class="flex-1 min-h-0 overflow-y-auto">
			<div class="space-y-0">
				<!-- Summary -->
				<div v-if="inlineTextContent" class="px-5 py-4">
					<p class="text-xs leading-relaxed text-muted-foreground line-clamp-5">
						{{ inlineTextContent }}
					</p>
				</div>

				<div v-if="inlineTextContent" class="h-px bg-border" />

				<!-- Metadata -->
				<div class="px-5 py-4">
				<div
					class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3"
				>
					Metadata
				</div>
				<div class="grid grid-cols-2 gap-x-6 gap-y-3">
					<div
						v-for="item in metadataItems"
						:key="item.label"
						class="flex items-start gap-2.5 text-sm"
					>
						<component
							:is="item.icon"
							class="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5"
						/>
						<div class="min-w-0">
							<div
								class="text-[10px] text-muted-foreground/70 uppercase tracking-wider"
							>
								{{ item.label }}
							</div>
							<div class="text-sm font-medium text-foreground/90 truncate">
								{{ item.value }}
							</div>
						</div>
					</div>

					<!-- Citations count -->
					<div class="flex items-start gap-2.5 text-sm">
						<Link2
							class="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5"
						/>
						<div class="min-w-0">
							<div
								class="text-[10px] text-muted-foreground/70 uppercase tracking-wider"
							>
								Citations
							</div>
							<div class="text-sm font-medium text-foreground/90">
								{{ citation.nCited }} Cited &middot;
								{{ citation.nCiting }} Citing
							</div>
						</div>
					</div>
				</div>

				<!-- Articles -->
				<div
					v-if="
						(citation.article_violated?.length ?? 0) +
							(citation.article_applied?.length ?? 0) +
							(citation.article_non_violated?.length ?? 0) >
						0
					"
					class="mt-4 space-y-3"
				>
					<div
						v-if="
							citation.article_violated && citation.article_violated.length > 0
						"
					>
						<div
							class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
						>
							Articles Violated
						</div>
						<div class="flex flex-wrap gap-1">
							<Badge
								v-for="article in citation.article_violated"
								:key="article"
								variant="outline"
								class="text-xs bg-red-50/70 text-red-700 border-red-200/70 dark:bg-red-950/35 dark:text-red-200 dark:border-red-800/60"
							>
								Art. {{ article }}
							</Badge>
						</div>
					</div>
					<div
						v-if="
							citation.article_applied && citation.article_applied.length > 0
						"
					>
						<div
							class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
						>
							Articles Applied
						</div>
						<div class="flex flex-wrap gap-1">
							<Badge
								v-for="article in citation.article_applied"
								:key="article"
								variant="outline"
								class="text-xs bg-blue-50/70 text-blue-700 border-blue-200/70 dark:bg-blue-950/35 dark:text-blue-200 dark:border-blue-800/60"
							>
								Art. {{ article }}
							</Badge>
						</div>
					</div>
					<div
						v-if="
							citation.article_non_violated &&
							citation.article_non_violated.length > 0
						"
					>
						<div
							class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
						>
							Articles Non-Violated
						</div>
						<div class="flex flex-wrap gap-1">
							<Badge
								v-for="article in citation.article_non_violated"
								:key="article"
								variant="outline"
								class="text-xs bg-emerald-50/70 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/35 dark:text-emerald-200 dark:border-emerald-800/60"
							>
								Art. {{ article }}
							</Badge>
						</div>
					</div>
				</div>

				<!-- Keywords -->
				<div
					v-if="citation.keywords && citation.keywords.length > 0"
					class="mt-4"
				>
					<div
						class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
					>
						Keywords
					</div>
					<div class="flex flex-wrap gap-1">
						<Badge
							v-for="keyword in citation.keywords"
							:key="keyword"
							variant="secondary"
							class="text-xs"
							>{{ keyword }}</Badge
						>
					</div>
				</div>

				<!-- Legal Provisions (RS) -->
				<div
					v-if="
						citation.legal_provisions && citation.legal_provisions.length > 0
					"
					class="mt-4"
				>
					<div
						class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
					>
						Legal Provisions
					</div>
					<div class="flex flex-wrap gap-1">
						<Badge
							v-for="prov in citation.legal_provisions"
							:key="prov"
							variant="outline"
							class="text-xs"
							>{{ prov }}</Badge
						>
					</div>
				</div>
			</div>

			<div class="h-px bg-border" />

			<!-- Full text (expandable, fetched from API) -->
			<div class="px-5 py-0">
				<button
					class="flex w-full items-center justify-between py-4 text-left"
					@click="toggleFullText"
				>
					<div class="flex items-center gap-2">
						<div
							class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
						>
							Document Text
						</div>
						<Loader2
							v-if="fullTextLoading"
							class="h-3 w-3 animate-spin text-muted-foreground/60"
						/>
						<Badge
							v-if="fullTextLanguage && fullTextExpanded"
							variant="outline"
							class="text-[10px] h-4 px-1.5"
						>
							{{ fullTextLanguage }}
						</Badge>
					</div>
					<ChevronDown
						v-if="!fullTextExpanded"
						class="h-4 w-4 text-muted-foreground/60"
					/>
					<ChevronUp v-else class="h-4 w-4 text-muted-foreground/60" />
				</button>

				<!-- Language selector (ECHR only, when expanded and multiple languages available) -->
				<div
					v-if="fullTextExpanded && availableLanguages.length > 1"
					class="flex flex-wrap gap-1.5 pb-3"
				>
					<button
						v-for="lang in availableLanguages"
						:key="lang"
						:class="[
							'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
							selectedLanguage === lang
								? 'border-primary/40 bg-primary/10 text-primary'
								: 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
						]"
						@click.stop="switchLanguage(lang)"
					>
						{{ getLanguageLabel(lang) }}
					</button>
				</div>
				<div v-if="fullTextExpanded" class="pb-4 space-y-3">
					<!-- Loading -->
					<div
						v-if="fullTextLoading && !fullTextContent"
						class="flex items-center justify-center py-6"
					>
						<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
						<span class="ml-2 text-xs text-muted-foreground"
							>Loading full text...</span
						>
					</div>

					<!-- Error -->
					<div
						v-else-if="fullTextError && !fullTextContent"
						class="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
					>
						{{ fullTextError }}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 ml-2 text-xs"
							@click="
								fullTextLoaded = false;
								loadFullText();
							"
							>Retry</Button
						>
					</div>

					<!-- Content -->
					<div v-else-if="fullTextContent">
						<p
							class="text-sm text-foreground/80 leading-relaxed whitespace-pre-line"
						>
							{{ fullTextContent }}
						</p>
					</div>

					<!-- No text available -->
					<div
						v-else
						class="rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
					>
						<p class="text-xs text-muted-foreground">
							Full text is not available for this document.
						</p>
						<p
							v-if="citation.url_publication"
							class="text-xs text-muted-foreground mt-1"
						>
							You can read the original on
							<a
								:href="citation.url_publication"
								target="_blank"
								rel="noopener noreferrer"
								class="text-primary hover:underline"
								>the source website</a
							>.
						</p>
					</div>
				</div>
			</div>

			<div v-if="hasCitesSection || hasCitedBySection" class="h-px bg-border" />

			<!-- Citations Graph (collapsible) -->
			<div v-if="hasCitesSection || hasCitedBySection" class="px-5 py-0">
				<div
					class="flex w-full items-center justify-between py-4 cursor-pointer"
					@click="toggleGraph"
				>
					<div class="flex items-center gap-2">
						<div
							class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
						>
							Citations Graph
						</div>
						<Badge variant="secondary" class="text-[10px] h-4 px-1.5">
							{{ citesCount + citedByCount }}
						</Badge>
					</div>
					<div class="flex items-center gap-1">
						<Tooltip text="Open full-page graph">
							<button
								class="flex h-6 items-center gap-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors px-1.5 text-[9px]"
								@click.stop="openGraphPage"
								aria-label="Open full-page graph"
							>
								<Maximize2 class="h-3 w-3" />
								<span class="hidden sm:inline">Expand</span>
							</button>
						</Tooltip>
						<ChevronDown
							v-if="!graphExpanded"
							class="h-4 w-4 text-muted-foreground/60"
						/>
						<ChevronUp v-else class="h-4 w-4 text-muted-foreground/60" />
					</div>
				</div>

				<div v-if="graphExpanded" class="pb-4">
					<div v-if="citedLoading" class="flex items-center justify-center py-6">
						<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
						<span class="ml-2 text-xs text-muted-foreground">Loading graph data...</span>
					</div>
					<ClientOnly v-else-if="citedLoaded && citation">
						<CitationGraph
							:root-ecli="citation.ecli"
							:root-citation="citation"
							:cites-eclis="expandCitesEclis"
							:cited-by-eclis="expandCitedByEclis"
							:cited-docs="citedDocs"
							@navigate="(ecli: string) => router.push({ path: '/document', query: { ecli } })"
						/>
					</ClientOnly>
				</div>
			</div>

			<div v-if="hasCitesSection || hasCitedBySection" class="h-px bg-border" />

			<!-- Cited Documents section (outgoing: documents this case cites) -->
			<div v-if="hasCitesSection" class="px-5 py-0">
				<button
					class="flex w-full items-center justify-between py-4 text-left"
					@click="toggleCites"
				>
					<div class="flex items-center gap-2">
						<div
							class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
						>
							Cited Documents
						</div>
						<Badge variant="secondary" class="text-[10px] h-4 px-1.5">
							{{ citesCount }}
						</Badge>
					</div>
					<ChevronDown
						v-if="!citesExpanded"
						class="h-4 w-4 text-muted-foreground/60"
					/>
					<ChevronUp v-else class="h-4 w-4 text-muted-foreground/60" />
				</button>

				<div v-if="citesExpanded" class="pb-4 space-y-2">
					<!-- Loading -->
					<div
						v-if="citedLoading"
						class="flex items-center justify-center py-6"
					>
						<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
						<span class="ml-2 text-xs text-muted-foreground"
							>Loading citations...</span
						>
					</div>

					<!-- Error -->
					<div
						v-else-if="citedError"
						class="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
					>
						{{ citedError }}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 ml-2 text-xs"
							@click="loadCitedDocuments"
							>Retry</Button
						>
					</div>

					<!-- Expanded doc cards -->
					<template v-else-if="citesDocsList.length > 0">
						<div class="space-y-1.5">
							<button
								v-for="doc in citesDocsList"
								:key="doc.ecli"
								class="group flex w-full items-start gap-3 rounded-lg border border-border/40 bg-background/80 px-3 py-2 text-left transition-colors hover:bg-accent/50"
								@click="emit('selectCitation', doc)"
							>
								<Badge
									:variant="doc.source === 'HUDOC' ? 'default' : 'secondary'"
									class="text-[10px] mt-0.5 shrink-0"
								>
									{{ doc.source === "HUDOC" ? "ECHR" : "RS" }}
								</Badge>
								<div class="min-w-0 flex-1">
									<div class="text-xs font-medium text-foreground truncate">
										{{ doc.title || doc.ecli }}
									</div>
									<code
										class="text-[10px] text-muted-foreground/70 font-mono"
										>{{ doc.ecli }}</code
									>
								</div>
							</button>
						</div>
					</template>

					<!-- Fallback: ECLI-only list (no expanded data) -->
					<template
						v-else-if="!citedLoading && (citation.cites?.length ?? 0) > 0"
					>
						<div class="space-y-1">
							<div
								v-for="ecli in citation.cites"
								:key="ecli"
								class="text-xs font-mono text-muted-foreground/80 truncate"
							>
								{{ ecli }}
							</div>
						</div>
					</template>
				</div>
			</div>

			<div v-if="hasCitesSection" class="h-px bg-border" />

			<!-- Cited By section (incoming: documents that cite this case) -->
			<div v-if="hasCitedBySection" class="px-5 py-0">
				<button
					class="flex w-full items-center justify-between py-4 text-left"
					@click="toggleCitedBy"
				>
					<div class="flex items-center gap-2">
						<div
							class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
						>
							Cited By
						</div>
						<Badge variant="secondary" class="text-[10px] h-4 px-1.5">
							{{ citedByCount }}
						</Badge>
					</div>
					<ChevronDown
						v-if="!citedByExpanded"
						class="h-4 w-4 text-muted-foreground/60"
					/>
					<ChevronUp v-else class="h-4 w-4 text-muted-foreground/60" />
				</button>

				<div v-if="citedByExpanded" class="pb-4 space-y-2">
					<!-- Loading -->
					<div
						v-if="citedLoading"
						class="flex items-center justify-center py-6"
					>
						<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
						<span class="ml-2 text-xs text-muted-foreground"
							>Loading citations...</span
						>
					</div>

					<!-- Error -->
					<div
						v-else-if="citedError"
						class="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
					>
						{{ citedError }}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 ml-2 text-xs"
							@click="loadCitedDocuments"
							>Retry</Button
						>
					</div>

					<!-- Expanded doc cards -->
					<template v-else-if="citedByDocsList.length > 0">
						<div class="space-y-1.5">
							<button
								v-for="doc in citedByDocsList"
								:key="doc.ecli"
								class="group flex w-full items-start gap-3 rounded-lg border border-border/40 bg-background/80 px-3 py-2 text-left transition-colors hover:bg-accent/50"
								@click="emit('selectCitation', doc)"
							>
								<Badge
									:variant="doc.source === 'HUDOC' ? 'default' : 'secondary'"
									class="text-[10px] mt-0.5 shrink-0"
								>
									{{ doc.source === "HUDOC" ? "ECHR" : "RS" }}
								</Badge>
								<div class="min-w-0 flex-1">
									<div class="text-xs font-medium text-foreground truncate">
										{{ doc.title || doc.ecli }}
									</div>
									<code
										class="text-[10px] text-muted-foreground/70 font-mono"
										>{{ doc.ecli }}</code
									>
								</div>
							</button>
						</div>
					</template>

					<!-- Fallback: ECLI-only list (no expanded data) -->
					<template
						v-else-if="!citedLoading && (citation.cited_by?.length ?? 0) > 0"
					>
						<div class="space-y-1">
							<div
								v-for="ecli in citation.cited_by"
								:key="ecli"
								class="text-xs font-mono text-muted-foreground/80 truncate"
							>
								{{ ecli }}
							</div>
						</div>
					</template>
				</div>
			</div>

			<div v-if="hasCitedBySection" class="h-px bg-border" />

			<!-- Bottom padding -->
			<div class="h-16" />
			</div>
		</div>
	</div>
</template>

<style scoped>
.doc-header-shadow {
	box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04);
}
</style>
