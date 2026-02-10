<script setup lang="ts">
import {
	ref,
	computed,
	watch,
	onMounted,
	onBeforeUnmount,
	nextTick,
	defineAsyncComponent,
} from "vue";
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
	ChevronDown,
	ChevronUp,
	ChevronLeft,
	ChevronRight,
	Loader2,
	Globe,
	Hash,
	Gavel,
	Link2,
	Link,
	ArrowLeft,
	BookOpen,
	Search,
	X,
	List,
	Bookmark,
	Highlighter,
	MessageSquare,
	Trash2,
	Pencil,
	FolderInput,
	Folder,
	Share2,
	AlertTriangle,
	Maximize2,
	GitFork,
} from "lucide-vue-next";
import AppHeader from "~/components/shared/AppHeader.vue";
import AppFooter from "~/components/shared/AppFooter.vue";
const CitationGraph = defineAsyncComponent(() =>
	import("~/components/shared/CitationGraph.vue"),
);
import {
	useUserData,
	type Highlight,
	type DocComment,
	type HighlightColor,
} from "~/composables/useUserData";
import Tooltip from "~/components/ui/tooltip/Tooltip.vue";
import Badge from "~/components/ui/badge/Badge.vue";
import Button from "~/components/ui/button/Button.vue";
import type { Citation } from "~/lib/types";
import { formatDate } from "~/lib/utils/utils";
import {
	fetchDocumentByEcli,
	fetchDocumentFullText,
	detectSourceFromEcli,
	type EchrLanguageEntry,
} from "~/lib/api/client";
import {
	encodeAnnotations,
	decodeAnnotations,
	reconstructHighlightText,
	hasAnnotations,
	type SharedAnnotations,
} from "~/lib/utils/share-annotations";

const route = useRoute();
const router = useRouter();
const userData = useUserData();

// ── State ──
const citation = ref<Citation | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const copied = ref(false);
const linkCopied = ref(false);
const shareCopied = ref(false);

// ── Shared annotations (from URL) ──
const sharedAnnotations = ref<SharedAnnotations | null>(null);
/** 'active' = showing banner + overlaying, 'saved' = user saved them, 'cleared' = user dismissed */
const sharedAnnotationState = ref<'active' | 'saved' | 'cleared' | 'ignored'>('active');
/** How many annotations were actually saved (after dedup) */
const sharedSavedCount = ref(0);

// Citation data
const citedDocs = ref<Citation[]>([]);
const citesEclis = ref<Set<string>>(new Set());
const citedByEclis = ref<Set<string>>(new Set());
const citesExpanded = ref(false);
const citedByExpanded = ref(false);
const graphExpanded = ref(true);

// Full text
const fullTextExpanded = ref(true);
const fetchedFullText = ref<string | null>(null);
const fullTextLoading = ref(false);
const fullTextError = ref<string | null>(null);
const fullTextLoaded = ref(false);
const fullTextLanguage = ref<string | null>(null);
const selectedLanguage = ref<string | null>(null);
const languagesMap = ref<Record<string, EchrLanguageEntry> | null>(null);
let fullTextAbort: AbortController | null = null;

// ── Text search ──
const textSearchOpen = ref(false);
const textSearchQuery = ref("");
const textSearchIndex = ref(0); // current match (0-based)
const textSearchInputRef = ref<HTMLInputElement | null>(null);
const textContentRef = ref<HTMLDivElement | null>(null);

// ── Outline sidebar ──
const outlineOpen = ref(true); // visible by default on large screens
const outlineSearch = ref("");
const docTextOutlineExpanded = ref(true);

// --- Outline resize ---
const OUTLINE_MIN = 200;
const OUTLINE_MAX = 400;
const OUTLINE_DEFAULT = 240;
const outlineWidth = ref(OUTLINE_DEFAULT);
let outlineResizing = false;
let outlineResizeStartX = 0;
let outlineResizeStartW = 0;

function onOutlineResizeStart(event: MouseEvent) {
	event.preventDefault();
	outlineResizing = true;
	outlineResizeStartX = event.clientX;
	outlineResizeStartW = outlineWidth.value;
	document.addEventListener("mousemove", onOutlineResizeMove);
	document.addEventListener("mouseup", onOutlineResizeEnd);
	document.body.style.cursor = "col-resize";
	document.body.style.userSelect = "none";
}

function onOutlineResizeMove(event: MouseEvent) {
	if (!outlineResizing) return;
	const dx = event.clientX - outlineResizeStartX;
	outlineWidth.value = Math.min(
		OUTLINE_MAX,
		Math.max(OUTLINE_MIN, outlineResizeStartW + dx),
	);
}

function onOutlineResizeEnd() {
	outlineResizing = false;
	document.removeEventListener("mousemove", onOutlineResizeMove);
	document.removeEventListener("mouseup", onOutlineResizeEnd);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
}

// --- Citations column resize ---
const CITE_MIN_RATIO = 0.2; // min 20% of container
const CITE_MAX_RATIO = 0.55; // max 55% of container
const CITE_DEFAULT_RATIO = 0.32; // default 32%
const citeWidthRatio = ref(CITE_DEFAULT_RATIO);
let citeResizing = false;
let citeResizeStartX = 0;
let citeResizeStartRatio = 0;
let citeContainerWidth = 0;

function onCiteResizeStart(event: MouseEvent) {
	event.preventDefault();
	citeResizing = true;
	citeResizeStartX = event.clientX;
	citeResizeStartRatio = citeWidthRatio.value;
	const container = (event.target as HTMLElement).closest("[data-doc-columns]");
	citeContainerWidth = container?.clientWidth || window.innerWidth;
	document.addEventListener("mousemove", onCiteResizeMove);
	document.addEventListener("mouseup", onCiteResizeEnd);
	document.body.style.cursor = "col-resize";
	document.body.style.userSelect = "none";
}

function onCiteResizeMove(event: MouseEvent) {
	if (!citeResizing) return;
	// Dragging left = wider citations, dragging right = narrower citations
	const dx = event.clientX - citeResizeStartX;
	const dxRatio = dx / citeContainerWidth;
	const newRatio = citeResizeStartRatio - dxRatio;
	citeWidthRatio.value = Math.min(CITE_MAX_RATIO, Math.max(CITE_MIN_RATIO, newRatio));
}

function onCiteResizeEnd() {
	citeResizing = false;
	document.removeEventListener("mousemove", onCiteResizeMove);
	document.removeEventListener("mouseup", onCiteResizeEnd);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
}

// ── Line highlight from URL ──
const highlightedLine = ref<number | null>(null);
const copiedLineNum = ref<number | null>(null);

// ── Annotations (highlights & comments) ──
const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; class: string }[] =
	[
		{ id: "yellow", label: "Yellow", class: "bg-yellow-400" },
		{ id: "green", label: "Green", class: "bg-green-400" },
		{ id: "blue", label: "Blue", class: "bg-blue-400" },
		{ id: "pink", label: "Pink", class: "bg-pink-400" },
		{ id: "orange", label: "Orange", class: "bg-orange-400" },
	];

// Floating toolbar state
const selectionToolbar = ref<{
	visible: boolean;
	x: number;
	y: number;
	startLine: number;
	startOffset: number;
	endLine: number;
	endOffset: number;
	selectedText: string;
}>({
	visible: false,
	x: 0,
	y: 0,
	startLine: 0,
	startOffset: 0,
	endLine: 0,
	endOffset: 0,
	selectedText: "",
});

// Highlight edit toolbar (shown when clicking on an existing highlight)
const highlightEditToolbar = ref<{
	visible: boolean;
	x: number;
	y: number;
	highlightId: string;
	currentColor: HighlightColor;
}>({ visible: false, x: 0, y: 0, highlightId: "", currentColor: "yellow" });

// Timeout ID for delayed toolbar hiding (prevents double-click race condition)
let hideToolbarTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Comment input state
const commentInputVisible = ref(false);
const commentInputText = ref("");
const commentInputStartLine = ref<number | undefined>(undefined);
const commentInputEndLine = ref<number | undefined>(undefined);
const commentInputRef = ref<HTMLTextAreaElement | null>(null);

// Editing comment
const editingCommentId = ref<string | null>(null);
const editingCommentText = ref("");

// Expanded inline comments (line-anchored shown inline)
const expandedCommentLines = ref<Set<number>>(new Set());

// For ECHR documents, scope inline annotations to the active language version
const annotationLanguageCode = computed(() =>
	citation.value?.source === "HUDOC" ? selectedLanguage.value ?? undefined : undefined,
);

// Computed for current document (scoped by language for ECHR)
const ownHighlights = computed(() =>
	ecli.value ? userData.getHighlightsForDoc(ecli.value, annotationLanguageCode.value) : [],
);
const ownComments = computed(() =>
	ecli.value ? userData.getCommentsForDoc(ecli.value, annotationLanguageCode.value) : [],
);

// Synthesise full Highlight / DocComment objects from shared payload so the
// rendering pipeline can treat them identically to user-owned annotations.
const sharedHighlightsFull = computed<Highlight[]>(() => {
	const sa = sharedAnnotations.value;
	if (!sa || (sharedAnnotationState.value !== 'active' && sharedAnnotationState.value !== 'ignored')) return [];
	const own = ownHighlights.value;
	return sa.highlights
		.filter((h) => !own.some(
			(e) =>
				e.startLine === h.startLine &&
				e.startOffset === h.startOffset &&
				e.endLine === h.endLine &&
				e.endOffset === h.endOffset &&
				(!h.languageCode || e.languageCode === h.languageCode),
		))
		.map((h, i) => ({
			id: `__shared_hl_${i}`,
			ecli: ecli.value,
			startLine: h.startLine,
			startOffset: h.startOffset,
			endLine: h.endLine,
			endOffset: h.endOffset,
			text: h.text,
			color: h.color,
			languageCode: h.languageCode,
			createdAt: 0,
		}));
});
const sharedCommentsFull = computed<DocComment[]>(() => {
	const sa = sharedAnnotations.value;
	if (!sa || (sharedAnnotationState.value !== 'active' && sharedAnnotationState.value !== 'ignored')) return [];
	const own = ownComments.value;
	return sa.comments
		.filter((c) => !own.some(
			(e) =>
				e.text === c.text &&
				e.startLine === c.startLine &&
				e.endLine === c.endLine &&
				(!c.languageCode || e.languageCode === c.languageCode),
		))
		.map((c, i) => ({
			id: `__shared_cm_${i}`,
			ecli: ecli.value,
			text: c.text,
			startLine: c.startLine,
			endLine: c.endLine,
			languageCode: c.languageCode,
			createdAt: 0,
			updatedAt: 0,
		}));
});

// Merged annotations (own + shared overlay)
const docHighlights = computed(() => [...ownHighlights.value, ...sharedHighlightsFull.value]);
const docComments = computed(() => [...ownComments.value, ...sharedCommentsFull.value]);

const docLevelComments = computed(() =>
	docComments.value.filter((c) => c.startLine === undefined),
);
const lineComments = computed(() =>
	docComments.value.filter((c) => c.startLine !== undefined),
);

// Helper: is this annotation from the shared URL?
function isSharedAnnotation(id: string): boolean {
	return id.startsWith('__shared_');
}

// Map: lineNumber -> highlights covering that line
const lineHighlightsMap = computed(() => {
	const map = new Map<number, Highlight[]>();
	for (const hl of docHighlights.value) {
		for (let i = hl.startLine; i <= hl.endLine; i++) {
			if (!map.has(i)) map.set(i, []);
			map.get(i)!.push(hl);
		}
	}
	return map;
});

// Map: lineNumber -> comments anchored at that line (first line of range)
const lineCommentAnchorMap = computed(() => {
	const map = new Map<number, DocComment[]>();
	for (const c of lineComments.value) {
		const line = c.startLine!;
		if (!map.has(line)) map.set(line, []);
		map.get(line)!.push(c);
	}
	return map;
});

function lineHasHighlight(lineNumber: number): boolean {
	return (lineHighlightsMap.value.get(lineNumber)?.length ?? 0) > 0;
}

// Map of line numbers that have a comment anchored to/through them
const commentedLinesMap = computed(() => {
	const map: Record<number, true> = {};
	for (const c of lineComments.value) {
		const start = c.startLine!;
		const end = c.endLine ?? start;
		for (let i = start; i <= end; i++) map[i] = true;
	}
	return map;
});

// ── Selection handling ──
function handleTextMouseUp(event: MouseEvent) {
	// Always cancel any pending hide timeout first (fixes double-click race)
	if (hideToolbarTimeoutId) {
		clearTimeout(hideToolbarTimeoutId);
		hideToolbarTimeoutId = null;
	}

	const sel = window.getSelection();
	if (!sel || sel.isCollapsed || !sel.toString().trim()) {
		// No text selected — check if we clicked on an existing highlight
		const hlMark = findUserHlMark(event.target as HTMLElement);
		if (hlMark) {
			showHighlightEditToolbar(hlMark);
			selectionToolbar.value.visible = false;
			return;
		}

		// Delay hiding to allow clicking toolbar buttons
		hideToolbarTimeoutId = setTimeout(() => {
			selectionToolbar.value.visible = false;
			highlightEditToolbar.value.visible = false;
			hideToolbarTimeoutId = null;
		}, 200);
		return;
	}

	// Text is selected — determine if it matches an existing highlight
	highlightEditToolbar.value.visible = false;

	// Determine which lines are selected
	const range = sel.getRangeAt(0);
	const startLine = getLineFromNode(range.startContainer);
	const endLine = getLineFromNode(range.endContainer);
	if (startLine === null || endLine === null) return;

	const minLine = Math.min(startLine, endLine);
	const maxLine = Math.max(startLine, endLine);
	const isReversed = startLine > endLine;

	// Compute character offsets within the line cells
	const startCell = getLineCellFromNode(range.startContainer);
	const endCell = getLineCellFromNode(range.endContainer);
	const rawStartOffset = startCell
		? getCharOffsetInCell(range.startContainer, range.startOffset, startCell)
		: 0;
	const rawEndOffset = endCell
		? getCharOffsetInCell(range.endContainer, range.endOffset, endCell)
		: 0;

	const startOffset = isReversed ? rawEndOffset : rawStartOffset;
	const endOffset = isReversed ? rawStartOffset : rawEndOffset;

	// Check if the selection exactly matches (or falls within) an existing highlight
	const matchingHl = docHighlights.value.find(
		(hl) =>
			hl.startLine === minLine &&
			hl.endLine === maxLine &&
			hl.startOffset === startOffset &&
			hl.endOffset === endOffset,
	);
	if (matchingHl) {
		// Don't allow editing shared highlights
		if (isSharedAnnotation(matchingHl.id)) return;
		// Show edit toolbar instead of creation toolbar
		const rect = range.getBoundingClientRect();
		highlightEditToolbar.value = {
			visible: true,
			x: rect.left + rect.width / 2,
			y: rect.top - 10,
			highlightId: matchingHl.id,
			currentColor: matchingHl.color,
		};
		selectionToolbar.value.visible = false;
		return;
	}

	// No matching highlight — show creation toolbar
	const rect = range.getBoundingClientRect();
	selectionToolbar.value = {
		visible: true,
		x: rect.left + rect.width / 2,
		y: rect.top - 10,
		startLine: minLine,
		startOffset,
		endLine: maxLine,
		endOffset,
		selectedText: sel.toString(),
	};
}

/** Walk up from a target element to find a <mark class="user-hl"> ancestor */
function findUserHlMark(el: HTMLElement | null): HTMLElement | null {
	while (el) {
		if (el.tagName === "MARK" && el.classList?.contains("user-hl")) return el;
		// Stop at the table cell boundary
		if (el.classList?.contains("doc-line-content")) return null;
		el = el.parentElement;
	}
	return null;
}

/** Show the edit toolbar positioned above a highlighted mark element */
function showHighlightEditToolbar(mark: HTMLElement) {
	const lineNum = getLineFromNode(mark);
	const cell = getLineCellFromNode(mark);
	if (!lineNum || !cell) return;

	// Compute the mark's char offset to find the matching Highlight
	const markOffset = getMarkStartOffset(mark, cell);
	const hl = findHighlightAtPosition(lineNum, markOffset);
	if (!hl) return;
	// Don't allow editing shared highlights
	if (isSharedAnnotation(hl.id)) return;

	const rect = mark.getBoundingClientRect();
	highlightEditToolbar.value = {
		visible: true,
		x: rect.left + rect.width / 2,
		y: rect.top - 10,
		highlightId: hl.id,
		currentColor: hl.color,
	};
}

/** Get the character offset of a mark element's start within its line cell */
function getMarkStartOffset(mark: HTMLElement, cell: HTMLElement): number {
	let charCount = 0;
	const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
	let textNode: Text | null;
	while ((textNode = walker.nextNode() as Text | null)) {
		if (mark.contains(textNode)) return charCount;
		charCount += textNode.textContent?.length || 0;
	}
	return charCount;
}

/** Find a highlight that covers a given line number + character offset */
function findHighlightAtPosition(
	lineNumber: number,
	charOffset: number,
): Highlight | null {
	for (const hl of docHighlights.value) {
		if (lineNumber < hl.startLine || lineNumber > hl.endLine) continue;
		const lineText =
			parsedLines.value.find((l) => l.lineNumber === lineNumber)?.text ?? "";
		let start = 0;
		let end = lineText.length;
		if (lineNumber === hl.startLine) start = hl.startOffset;
		if (lineNumber === hl.endLine) end = hl.endOffset;
		if (charOffset >= start && charOffset < end) return hl;
	}
	return null;
}

function getLineFromNode(node: Node): number | null {
	let el: HTMLElement | null =
		node instanceof HTMLElement ? node : node.parentElement;
	while (el) {
		if (el.tagName === "TR" && el.id?.startsWith("L")) {
			return parseInt(el.id.slice(1), 10);
		}
		el = el.parentElement;
	}
	return null;
}

function getLineCellFromNode(node: Node): HTMLElement | null {
	let el: HTMLElement | null =
		node instanceof HTMLElement ? node : node.parentElement;
	while (el) {
		if (el.classList?.contains("doc-line-content")) return el;
		el = el.parentElement;
	}
	return null;
}

function getCharOffsetInCell(
	node: Node,
	offset: number,
	cell: HTMLElement,
): number {
	// For text nodes: offset is char position; for element nodes: offset is child index
	if (node.nodeType === Node.TEXT_NODE) {
		let charCount = 0;
		const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
		let textNode: Text | null;
		while ((textNode = walker.nextNode() as Text | null)) {
			if (textNode === node) return charCount + offset;
			charCount += textNode.textContent?.length || 0;
		}
		return charCount + offset;
	}
	// Element node: count text before the offset-th child
	if (offset >= node.childNodes.length) return cell.textContent?.length || 0;
	const targetChild = node.childNodes[offset];
	let charCount = 0;
	const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
	let textNode: Text | null;
	while ((textNode = walker.nextNode() as Text | null)) {
		if (targetChild.contains(textNode) || targetChild === textNode)
			return charCount;
		charCount += textNode.textContent?.length || 0;
	}
	return charCount;
}

function createHighlight(color: HighlightColor) {
	if (!ecli.value) return;
	const { startLine, startOffset, endLine, endOffset, selectedText } =
		selectionToolbar.value;
	userData.addHighlight(
		ecli.value,
		startLine,
		startOffset,
		endLine,
		endOffset,
		selectedText,
		color,
		annotationLanguageCode.value,
	);
	selectionToolbar.value.visible = false;
	window.getSelection()?.removeAllRanges();
}

function changeHighlightColor(color: HighlightColor) {
	if (!highlightEditToolbar.value.highlightId) return;
	if (isSharedAnnotation(highlightEditToolbar.value.highlightId)) return;
	userData.updateHighlightColor(highlightEditToolbar.value.highlightId, color);
	highlightEditToolbar.value.currentColor = color;
}

function removeHighlightFromToolbar() {
	if (!highlightEditToolbar.value.highlightId) return;
	if (isSharedAnnotation(highlightEditToolbar.value.highlightId)) return;
	userData.removeHighlight(highlightEditToolbar.value.highlightId);
	highlightEditToolbar.value.visible = false;
}

function removeLineHighlight(lineNumber: number) {
	const highlights = lineHighlightsMap.value.get(lineNumber);
	if (highlights && highlights.length > 0 && !isSharedAnnotation(highlights[0].id))
		userData.removeHighlight(highlights[0].id);
}

// ── Comment creation from toolbar ──
function startCommentFromSelection() {
	const { startLine, endLine } = selectionToolbar.value;
	commentInputStartLine.value = startLine;
	commentInputEndLine.value = endLine;
	commentInputVisible.value = true;
	commentInputText.value = "";
	selectionToolbar.value.visible = false;
	window.getSelection()?.removeAllRanges();
	nextTick(() => commentInputRef.value?.focus());
}

function startDocumentComment() {
	commentInputStartLine.value = undefined;
	commentInputEndLine.value = undefined;
	commentInputVisible.value = true;
	commentInputText.value = "";
	nextTick(() => commentInputRef.value?.focus());
}

function submitComment() {
	const text = commentInputText.value.trim();
	if (!text || !ecli.value) return;
	userData.addComment(
		ecli.value,
		text,
		commentInputStartLine.value,
		commentInputEndLine.value,
		annotationLanguageCode.value,
	);
	commentInputVisible.value = false;
	commentInputText.value = "";
	// Auto-expand inline view for line-anchored comments
	if (commentInputStartLine.value !== undefined) {
		expandedCommentLines.value.add(commentInputStartLine.value);
	}
}

/** Submit from the always-visible doc-level input */
function submitDocComment() {
	const text = commentInputText.value.trim();
	if (!text || !ecli.value) return;
	// Doc-level comments are not language-scoped (they apply to the document as a whole)
	userData.addComment(ecli.value, text);
	commentInputText.value = "";
	commentInputVisible.value = false;
	// Reset textarea height
	nextTick(() => {
		if (commentInputRef.value) commentInputRef.value.style.height = "auto";
	});
}

function blurCommentInput() {
	if (!commentInputText.value.trim()) {
		commentInputVisible.value = false;
	}
	commentInputRef.value?.blur();
}

function cancelComment() {
	commentInputVisible.value = false;
	commentInputText.value = "";
}

function startEditComment(c: DocComment) {
	editingCommentId.value = c.id;
	editingCommentText.value = c.text;
}

function saveEditComment() {
	if (editingCommentId.value && editingCommentText.value.trim()) {
		userData.editComment(
			editingCommentId.value,
			editingCommentText.value.trim(),
		);
	}
	editingCommentId.value = null;
	editingCommentText.value = "";
}

function cancelEditComment() {
	editingCommentId.value = null;
	editingCommentText.value = "";
}

function deleteComment(id: string) {
	userData.removeComment(id);
}

function toggleCommentLine(lineNum: number) {
	const s = new Set(expandedCommentLines.value);
	s.has(lineNum) ? s.delete(lineNum) : s.add(lineNum);
	expandedCommentLines.value = s;
}

function formatCommentTime(ts: number) {
	const diff = Date.now() - ts;
	if (diff < 60_000) return "Just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return new Date(ts).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

// ── Navigation context ──
// Store the referrer URL as a fallback for when the page was opened in a new tab
const referrerPath = ref<string | null>(null);

// ── Computed ──
const ecli = computed(() => {
	const q = route.query.ecli;
	return typeof q === "string" ? q : Array.isArray(q) ? q[0] || "" : "";
});

const isEchr = computed(() => citation.value?.source === "HUDOC");
const isSaved = computed(() =>
	citation.value ? userData.isDocSaved(citation.value.ecli) : false,
);

const availableLanguages = computed(() => {
	if (languagesMap.value) {
		return Object.keys(languagesMap.value).filter(
			(lang) => languagesMap.value![lang].full_text_available,
		);
	}
	return [];
});

const date = computed(
	() => citation.value?.date || citation.value?.date_judgment || "",
);

const importanceLabel = computed(() =>
	citation.value?.importance === 1
		? "Key case"
		: citation.value?.importance === 2
			? "Important"
			: citation.value?.importance === 3
				? "Moderate"
				: citation.value?.importance === 4
					? "Low importance"
					: "",
);

const hasCitesSection = computed(
	() =>
		citesEclis.value.size > 0 ||
		(citation.value?.cites?.length ?? 0) > 0 ||
		(citation.value?.nCiting ?? 0) > 0,
);
const hasCitedBySection = computed(
	() =>
		citedByEclis.value.size > 0 ||
		(citation.value?.cited_by?.length ?? 0) > 0 ||
		(citation.value?.nCited ?? 0) > 0,
);

const citesCount = computed(() => {
	if (citesEclis.value.size > 0) return citesEclis.value.size;
	if (citation.value?.cites?.length) return citation.value.cites.length;
	return citation.value?.nCiting ?? 0;
});
const citedByCount = computed(() => {
	if (citedByEclis.value.size > 0) return citedByEclis.value.size;
	if (citation.value?.cited_by?.length) return citation.value.cited_by.length;
	return citation.value?.nCited ?? 0;
});

const citesDocsList = computed(() => {
	if (citedDocs.value.length === 0) return [];
	if (citesEclis.value.size > 0) {
		return citedDocs.value.filter((d) => citesEclis.value.has(d.ecli));
	}
	return [];
});
const citedByDocsList = computed(() => {
	if (citedDocs.value.length === 0) return [];
	if (citedByEclis.value.size > 0) {
		return citedDocs.value.filter((d) => citedByEclis.value.has(d.ecli));
	}
	return [];
});

const fullTextContent = computed(() => fetchedFullText.value || "");

const LANGUAGE_LABELS: Record<string, string> = {
	ENG: "English",
	FRE: "French",
	GER: "German",
	ITA: "Italian",
	SPA: "Spanish",
	RUS: "Russian",
	TUR: "Turkish",
	DUT: "Dutch",
	ROM: "Romanian",
	GRE: "Greek",
	POL: "Polish",
	HUN: "Hungarian",
	BUL: "Bulgarian",
	CZE: "Czech",
	POR: "Portuguese",
	SWE: "Swedish",
	FIN: "Finnish",
	NOR: "Norwegian",
	EST: "Estonian",
	LAV: "Latvian",
	LIT: "Lithuanian",
	SLO: "Slovak",
	SLV: "Slovenian",
	ALB: "Albanian",
};

function getLanguageLabel(code: string) {
	return LANGUAGE_LABELS[code] || code;
}

// Metadata items
const metadataItems = computed(() => {
	if (!citation.value) return [];
	const c = citation.value;
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
	if (c.language)
		items.push({ label: "Language", value: c.language, icon: Globe });
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

// ── Text helpers ──
function fixPunctuation(text: string): string {
	return text
		.replace(/([.])([A-Za-z])/g, "$1 $2")
		.replace(/([;:!?])([A-Za-z0-9(])/g, "$1 $2")
		.replace(/([,])([A-Za-z(])/g, "$1 $2")
		.replace(/(\))([A-Za-z0-9(])/g, "$1 $2");
}

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

const inlineTextContent = computed(() => {
	if (!citation.value) return "";
	const parts: string[] = [];
	if (citation.value.headnote) parts.push(citation.value.headnote);
	if (
		citation.value.conclusion &&
		citation.value.conclusion !== citation.value.headnote
	)
		parts.push(citation.value.conclusion);
	if (citation.value.summary && !parts.includes(citation.value.summary))
		parts.push(citation.value.summary);
	let text = parts.join("\n\n");
	text = stripLeadingTitle(text, citation.value.title);
	text = fixPunctuation(text);
	return text.trim();
});

// ── Parsed full-text lines ──
type DocLine = {
	lineNumber: number;
	text: string;
	isHeading: boolean;
	isEmpty: boolean;
};

const parsedLines = computed<DocLine[]>(() => {
	if (!fullTextContent.value) return [];
	const raw = fullTextContent.value.split("\n");
	const source = isEchr.value ? "ECHR" : "RS";

	// First pass: basic line data
	const lines = raw.map((line, i) => {
		const trimmed = line.trim();
		return {
			lineNumber: i + 1,
			text: line,
			isHeading: false,
			isEmpty: trimmed.length === 0,
		};
	});

	// Second pass: detect headings with surrounding-line context
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].text.trim();
		lines[i].isHeading = isHeadingLine(trimmed, source, lines, i);
	}

	return lines;
});

// ── Reconstruct shared-highlight text once document lines are available ──
// v2 shared URLs omit highlight text to keep URLs short.  Once the full text
// has loaded we can derive the highlighted text from the line positions.
watch(parsedLines, (lines) => {
	const sa = sharedAnnotations.value;
	if (!sa || lines.length === 0) return;
	// Only reconstruct if any highlight is missing text
	if (sa.highlights.every(h => h.text)) return;
	reconstructHighlightText(sa, lines);
	// Trigger reactivity so sharedHighlightsFull recomputes
	sharedAnnotations.value = { ...sa };
}, { immediate: true });

/**
 * Detect heading lines.
 *
 * ECHR: fully uppercase lines with 3+ chars (e.g. "PROCEDURE", "THE FACTS", "THE LAW")
 *
 * Rechtspraak: numbered section headers in the format "XTitle" where X is a digit
 * and Title starts with an uppercase letter (e.g. "1Inleiding", "2Feiten").
 * These are typically surrounded by empty lines.
 *
 * Common: Roman numeral section starts (I., II., III., etc.)
 */
function isHeadingLine(
	text: string,
	source: string,
	lines: { text: string; isEmpty: boolean }[],
	index: number,
): boolean {
	if (text.length < 2) return false;

	// ── ECHR only: fully uppercase line (at least 3 word chars, no lowercase) ──
	if (
		source === "ECHR" &&
		/^[^a-z]*$/.test(text) &&
		/[A-Z]{3,}/.test(text) &&
		text.length < 200
	)
		return true;

	// ── Roman numeral section starts: "I.", "II.", "III.", "IV." etc. ──
	if (/^(I{1,3}|IV|VI{0,3}|IX|X{1,3})\.\s+\S/.test(text)) return true;

	// ── Rechtspraak: "XTitle" — digit(s) followed by uppercase letter ──
	// e.g. "1Inleiding", "2Feiten", "3Beoordeling", "10Beslissing"
	// Must be surrounded by empty lines (or be first/last line)
	if (/^\d+[A-Z][a-zA-Z]/.test(text) && text.length < 80) {
		const prevEmpty = index === 0 || lines[index - 1].isEmpty;
		const nextEmpty = index === lines.length - 1 || lines[index + 1].isEmpty;
		if (prevEmpty && nextEmpty) return true;
	}

	// ── Rechtspraak: "X.X Title" or "X Title" — numbered with separator ──
	// e.g. "1. Inleiding", "2.1 Feiten", "3 Beoordeling"
	if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(text) && text.length < 100) {
		const prevEmpty = index === 0 || lines[index - 1].isEmpty;
		const nextEmpty = index === lines.length - 1 || lines[index + 1].isEmpty;
		if (prevEmpty && nextEmpty) return true;
	}

	// ── Rechtspraak: "Bijlage X" — attachment headers ──
	if (/^Bijlage\s+\S/i.test(text) && text.length < 80) {
		const prevEmpty = index === 0 || lines[index - 1].isEmpty;
		const nextEmpty = index === lines.length - 1 || lines[index + 1].isEmpty;
		if (prevEmpty && nextEmpty) return true;
	}

	return false;
}

// ── Outline from headings ──
type OutlineItem = {
	lineNumber?: number;
	sectionId?: string; // for page-level sections (not line-based)
	text: string;
	isSection?: boolean; // true for top-level page sections
};

/**
 * Format a heading for display in the outline.
 * For Rechtspraak "1Inleiding" style, insert a space: "1 Inleiding".
 */
function formatHeadingText(text: string): string {
	const trimmed = text.trim();
	// "1Inleiding" → "1 Inleiding", "10Beslissing" → "10 Beslissing"
	if (/^\d+[A-Z]/.test(trimmed)) {
		return trimmed.replace(/^(\d+)([A-Z])/, "$1 $2");
	}
	return trimmed;
}

const textHeadingItems = computed<OutlineItem[]>(() => {
	return parsedLines.value
		.filter((l) => l.isHeading)
		.map((l) => ({
			lineNumber: l.lineNumber,
			text: formatHeadingText(l.text),
		}));
});

const outlineItems = computed<OutlineItem[]>(() => {
	const items: OutlineItem[] = [];

	// Page sections
	items.push({
		sectionId: "section-comments",
		text: "Comments",
		isSection: true,
	});

	if (inlineTextContent.value) {
		items.push({
			sectionId: "section-summary",
			text: "Summary",
			isSection: true,
		});
	}
	items.push({
		sectionId: "section-metadata",
		text: "Metadata",
		isSection: true,
	});

	if (fullTextContent.value || fullTextLoading.value) {
		items.push({
			sectionId: "section-fulltext",
			text: "Document Text",
			isSection: true,
		});
		// Document headings nested under Document Text
		for (const h of textHeadingItems.value) {
			items.push(h);
		}
	}

	if (hasCitesSection.value || hasCitedBySection.value) {
		items.push({
			sectionId: "section-citation-graph",
			text: "Citations Graph",
			isSection: true,
		});
	}
	if (hasCitesSection.value) {
		items.push({
			sectionId: "section-cited",
			text: "Cited Documents",
			isSection: true,
		});
	}
	if (hasCitedBySection.value) {
		items.push({
			sectionId: "section-citedby",
			text: "Cited By",
			isSection: true,
		});
	}

	return items;
});

// Filtered outline items (search + collapse)
const filteredOutlineItems = computed<OutlineItem[]>(() => {
	const q = outlineSearch.value.trim().toLowerCase();
	let items = outlineItems.value;

	// Apply search filter
	if (q) {
		items = items.filter((item) => {
			if (item.isSection) return true; // always show section headers
			return item.text.toLowerCase().includes(q);
		});
		// Remove section headers that have no children after filtering
		// (only "Document Text" can have children)
		const filtered: OutlineItem[] = [];
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.sectionId === "section-fulltext") {
				// Check if any non-section items follow before the next section
				const hasChildren = items.slice(i + 1).some((next) => !next.isSection);
				if (hasChildren || !q) filtered.push(item);
				else filtered.push(item); // always show Document Text header
			} else {
				filtered.push(item);
			}
		}
		items = filtered;
	}

	// Apply Document Text collapse (hide text heading children)
	if (!docTextOutlineExpanded.value && !q) {
		items = items.filter((item) => {
			// Keep section items, filter out text headings (non-section items under Document Text)
			return item.isSection || item.sectionId;
		});
	}

	return items;
});

// ── Text search ──
const searchMatches = computed<number[]>(() => {
	if (!textSearchQuery.value || textSearchQuery.value.length < 2) return [];
	const q = textSearchQuery.value.toLowerCase();
	const matches: number[] = [];
	for (const line of parsedLines.value) {
		if (line.text.toLowerCase().includes(q)) {
			matches.push(line.lineNumber);
		}
	}
	return matches;
});

const totalMatches = computed(() => searchMatches.value.length);

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render a line with inline user highlights and search highlights as HTML.
 * Uses a boundary-point algorithm to correctly handle overlapping ranges.
 */
function renderLine(line: { lineNumber: number; text: string }): string {
	const text = line.text;
	if (text.length === 0) return "";

	const marks: { start: number; end: number; cls: string }[] = [];

	// User highlights covering this line
	for (const hl of docHighlights.value) {
		if (line.lineNumber < hl.startLine || line.lineNumber > hl.endLine)
			continue;
		let start = 0;
		let end = text.length;
		if (line.lineNumber === hl.startLine)
			start = Math.min(hl.startOffset, text.length);
		if (line.lineNumber === hl.endLine)
			end = Math.min(hl.endOffset, text.length);
		if (start < end) {
			marks.push({ start, end, cls: `user-hl user-hl-${hl.color}` });
		}
	}

	// Search highlights
	if (textSearchQuery.value && textSearchQuery.value.length >= 2) {
		const q = textSearchQuery.value.toLowerCase();
		const lower = text.toLowerCase();
		let idx = 0;
		while ((idx = lower.indexOf(q, idx)) !== -1) {
			marks.push({ start: idx, end: idx + q.length, cls: "search-highlight" });
			idx += q.length;
		}
	}

	if (marks.length === 0) return escapeHtml(text);

	// Collect boundary points
	const pointSet = new Set<number>();
	pointSet.add(0);
	pointSet.add(text.length);
	for (const m of marks) {
		pointSet.add(Math.max(0, m.start));
		pointSet.add(Math.min(text.length, m.end));
	}
	const points = [...pointSet].sort((a, b) => a - b);

	// Build HTML for each segment between boundary points
	let html = "";
	for (let k = 0; k < points.length - 1; k++) {
		const segStart = points[k];
		const segEnd = points[k + 1];
		const classes: string[] = [];
		for (const m of marks) {
			if (m.start <= segStart && m.end >= segEnd) {
				classes.push(m.cls);
			}
		}
		const segment = escapeHtml(text.slice(segStart, segEnd));
		if (classes.length > 0) {
			html += `<mark class="${classes.join(" ")}">${segment}</mark>`;
		} else {
			html += segment;
		}
	}
	return html;
}

function goToSearchMatch(index: number) {
	if (searchMatches.value.length === 0) return;
	const clamped =
		((index % totalMatches.value) + totalMatches.value) % totalMatches.value;
	textSearchIndex.value = clamped;
	const lineNum = searchMatches.value[clamped];
	scrollToLine(lineNum);
}

function nextMatch() {
	goToSearchMatch(textSearchIndex.value + 1);
}

function prevMatch() {
	goToSearchMatch(textSearchIndex.value - 1);
}

function openTextSearch() {
	textSearchOpen.value = true;
	nextTick(() => textSearchInputRef.value?.focus());
}

function closeTextSearch() {
	textSearchOpen.value = false;
	textSearchQuery.value = "";
	textSearchIndex.value = 0;
}

// ── Line linking ──
function scrollToLine(lineNum: number) {
	const el = document.getElementById(`L${lineNum}`);
	if (el) {
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		highlightedLine.value = lineNum;
	}
}

function copyLineLink(lineNum: number) {
	if (typeof window === "undefined") return;
	const url = new URL(window.location.href);
	url.hash = `L${lineNum}`;
	navigator.clipboard.writeText(url.toString());
	highlightedLine.value = lineNum;
	copiedLineNum.value = lineNum;
	setTimeout(() => {
		if (copiedLineNum.value === lineNum) copiedLineNum.value = null;
	}, 1500);
}

function scrollToOutlineItem(item: OutlineItem) {
	if (item.sectionId) {
		const el = document.getElementById(item.sectionId);
		if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
	} else if (item.lineNumber) {
		scrollToLine(item.lineNumber);
	}
}

// ── Actions ──
function copyEcli() {
	if (!citation.value) return;
	navigator.clipboard.writeText(citation.value.ecli);
	copied.value = true;
	setTimeout(() => (copied.value = false), 2000);
}

function copyDocumentLink() {
	if (typeof window === "undefined") return;
	navigator.clipboard.writeText(window.location.href);
	linkCopied.value = true;
	setTimeout(() => (linkCopied.value = false), 2000);
}

function shareWithAnnotations() {
	if (typeof window === "undefined" || !ecli.value) return;
	const allHighlights = ownHighlights.value;
	const allComments = ownComments.value;
	if (!hasAnnotations(allHighlights, allComments)) {
		// No annotations — just copy the plain link
		copyDocumentLink();
		return;
	}
	const encoded = encodeAnnotations(allHighlights, allComments);
	const url = new URL(window.location.href);
	url.searchParams.set("shared", encoded);
	navigator.clipboard.writeText(url.toString());
	shareCopied.value = true;
	setTimeout(() => (shareCopied.value = false), 2000);
}

// ── Shared annotations: import actions ──
function saveSharedAnnotations() {
	const sa = sharedAnnotations.value;
	if (!sa || !ecli.value) return;

	const existing = ownHighlights.value;
	const existingComments = ownComments.value;
	let savedCount = 0;

	for (const h of sa.highlights) {
		// Deduplicate: skip if an identical highlight already exists at the same position
		const duplicate = existing.some(
			(e) =>
				e.startLine === h.startLine &&
				e.startOffset === h.startOffset &&
				e.endLine === h.endLine &&
				e.endOffset === h.endOffset &&
				e.text === h.text &&
				(!h.languageCode || e.languageCode === h.languageCode),
		);
		if (!duplicate) {
			userData.addHighlight(
				ecli.value,
				h.startLine,
				h.startOffset,
				h.endLine,
				h.endOffset,
				h.text,
				h.color,
				h.languageCode,
			);
			savedCount++;
		}
	}
	for (const c of sa.comments) {
		// Deduplicate: skip if a comment with the same text and anchor already exists
		const duplicate = existingComments.some(
			(e) =>
				e.text === c.text &&
				e.startLine === c.startLine &&
				e.endLine === c.endLine &&
				(!c.languageCode || e.languageCode === c.languageCode),
		);
		if (!duplicate) {
			userData.addComment(ecli.value, c.text, c.startLine, c.endLine, c.languageCode);
			savedCount++;
		}
	}

	sharedAnnotationState.value = 'saved';
	sharedSavedCount.value = savedCount;
	// Remove the shared param from URL
	clearSharedUrlParam();
}

function clearSharedAnnotations() {
	sharedAnnotationState.value = 'cleared';
	clearSharedUrlParam();
}

function ignoreSharedAnnotations() {
	sharedAnnotationState.value = 'ignored';
}

function clearSharedUrlParam() {
	if (typeof window === "undefined") return;
	const url = new URL(window.location.href);
	url.searchParams.delete("shared");
	router.replace({ query: { ...route.query, shared: undefined } });
}

function toggleSave() {
	if (!citation.value) return;
	userData.toggleSaveDocument(citation.value);
}

// ── Folder picker ──
const folderPickerOpen = ref(false);

function addToFolder(folderId: string) {
	if (!citation.value) return;
	// Ensure doc is saved first
	if (!userData.isDocSaved(citation.value.ecli)) {
		userData.toggleSaveDocument(citation.value);
	}
	userData.addDocumentToFolder(citation.value.ecli, folderId);
	folderPickerOpen.value = false;
}

function openOriginalDocument() {
	if (!citation.value?.url_publication) return;
	if (typeof window === "undefined") return;
	window.open(citation.value.url_publication, "_blank");
}

function goBack() {
	// Vue Router stores the previous route in history.state.back
	// If it exists, there's a real page to go back to in the router history
	const historyState = window.history.state;
	if (historyState?.back) {
		router.back();
		return;
	}
	// No router history (e.g. opened in a new tab) — use the referrer if available
	if (referrerPath.value) {
		router.push(referrerPath.value);
		return;
	}
	// Last resort: go home
	router.push("/");
}

function openCitedDocument(doc: Citation) {
	router.push({ path: "/document", query: { ecli: doc.ecli } });
}

// ── Data fetching ──
async function loadDocument(ecliStr: string) {
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

	// Track document view
	userData.trackDocumentView(result.citation);

	loadFullText();
}

async function loadFullText() {
	if (!citation.value) return;
	fullTextLoading.value = true;
	fullTextError.value = null;

	if (fullTextAbort) fullTextAbort.abort();
	fullTextAbort = new AbortController();

	try {
		const result = await fetchDocumentFullText(
			citation.value.ecli,
			citation.value.source as "HUDOC" | "Rechtspraak",
			{ signal: fullTextAbort.signal },
		);
		if (result.error) fullTextError.value = result.error;
		if (result.languages) languagesMap.value = result.languages;

		const lang = result.defaultLanguage || result.language || null;
		fullTextLanguage.value = lang;
		selectedLanguage.value = lang;
		fetchedFullText.value = result.fullText;
		fullTextLoaded.value = true;

		// After text loads, scroll to URL hash line if present
		nextTick(() => {
			const hash = route.hash;
			if (hash && hash.startsWith("#L")) {
				const lineNum = parseInt(hash.slice(2), 10);
				if (!isNaN(lineNum) && lineNum > 0) {
					setTimeout(() => scrollToLine(lineNum), 100);
				}
			}
		});
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

// ── Keyboard shortcuts ──
function handleKeydown(e: KeyboardEvent) {
	// Ctrl/Cmd+F to open text search (when full text is visible)
	if (
		(e.ctrlKey || e.metaKey) &&
		e.key === "f" &&
		fullTextContent.value &&
		fullTextExpanded.value
	) {
		e.preventDefault();
		openTextSearch();
	}
	// Escape to close search or toolbar
	if (e.key === "Escape") {
		if (textSearchOpen.value) closeTextSearch();
		if (selectionToolbar.value.visible) selectionToolbar.value.visible = false;
		if (highlightEditToolbar.value.visible)
			highlightEditToolbar.value.visible = false;
		if (commentInputVisible.value) cancelComment();
		if (folderPickerOpen.value) folderPickerOpen.value = false;
	}
	// Enter/Shift+Enter to navigate search matches
	if (e.key === "Enter" && textSearchOpen.value) {
		e.preventDefault();
		if (e.shiftKey) prevMatch();
		else nextMatch();
	}
}

// ── Lifecycle ──
onMounted(() => {
	// Capture the referrer path from query param (set by results page "open in new page" button)
	const from = route.query.from;
	if (typeof from === "string" && from.startsWith("/")) {
		referrerPath.value = from;
	}
	// Detect shared annotations in URL
	const sharedParam = route.query.shared;
	if (typeof sharedParam === "string" && sharedParam.length > 0) {
		const decoded = decodeAnnotations(sharedParam);
		if (decoded && (decoded.highlights.length > 0 || decoded.comments.length > 0)) {
			sharedAnnotations.value = decoded;
			sharedAnnotationState.value = 'active';
		}
	}
	loadDocument(ecli.value);
	document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
	document.removeEventListener("keydown", handleKeydown);
});

watch(ecli, (newEcli) => {
	// Reset all state
	fullTextExpanded.value = true;
	citesExpanded.value = false;
	citedByExpanded.value = false;
	graphExpanded.value = true;
	citedDocs.value = [];
	citesEclis.value = new Set();
	citedByEclis.value = new Set();
	if (fullTextAbort) fullTextAbort.abort();
	fetchedFullText.value = null;
	fullTextLoading.value = false;
	fullTextError.value = null;
	fullTextLoaded.value = false;
	fullTextLanguage.value = null;
	selectedLanguage.value = null;
	languagesMap.value = null;
	textSearchOpen.value = false;
	textSearchQuery.value = "";
	textSearchIndex.value = 0;
	// outlineOpen stays as-is so the sidebar persists across document navigation
	outlineSearch.value = "";
	folderPickerOpen.value = false;
	highlightedLine.value = null;
	selectionToolbar.value.visible = false;
	highlightEditToolbar.value.visible = false;
	commentInputVisible.value = false;
	expandedCommentLines.value = new Set();
	editingCommentId.value = null;
	// Reset shared annotations
	sharedAnnotations.value = null;
	sharedAnnotationState.value = 'active';

	// Check for shared annotations in new URL
	const sharedParam = route.query.shared;
	if (typeof sharedParam === "string" && sharedParam.length > 0) {
		const decoded = decodeAnnotations(sharedParam);
		if (decoded && (decoded.highlights.length > 0 || decoded.comments.length > 0)) {
			sharedAnnotations.value = decoded;
			sharedAnnotationState.value = 'active';
		}
	}

	loadDocument(newEcli);
});

useHead({
	title: computed(() =>
		citation.value?.title
			? `${citation.value.title} – LegalSearch`
			: ecli.value
				? `${ecli.value} – LegalSearch`
				: "Document – LegalSearch",
	),
});
</script>

<template>
	<div class="min-h-screen flex flex-col bg-background">
		<AppHeader fixed />
		<div class="pt-12">
			<!-- Loading -->
			<div
				v-if="loading"
				class="flex-1 flex items-center justify-center min-h-[60vh]"
			>
				<div class="flex flex-col items-center gap-3">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
					<p class="text-sm text-muted-foreground">Loading document...</p>
				</div>
			</div>

			<!-- Error -->
			<div
				v-else-if="error"
				class="flex-1 flex items-center justify-center min-h-[60vh]"
			>
				<div class="max-w-md text-center space-y-4">
					<p class="text-sm text-destructive">{{ error }}</p>
					<div class="flex items-center justify-center gap-3">
						<Button variant="outline" size="sm" @click="goBack">
							<ArrowLeft class="h-3.5 w-3.5 mr-1.5" />
							Go back
						</Button>
						<Button variant="outline" size="sm" @click="loadDocument(ecli)">
							Retry
						</Button>
					</div>
				</div>
			</div>

			<!-- Document -->
			<div v-else-if="citation" class="flex min-h-[calc(100vh-3rem)]">
				<!-- ── Outline sidebar (full-height, attached to left) ── -->
				<aside
					v-if="outlineOpen && outlineItems.length > 0"
					class="doc-outline-sidebar shrink-0 hidden lg:flex flex-col sticky top-12 self-start h-[calc(100vh-3rem)] overflow-hidden"
					:style="{ width: outlineWidth + 'px' }"
				>
					<!-- Outline header -->
					<div class="flex items-center justify-between px-4 py-3 shrink-0">
						<span
							class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
							>Outline</span
						>
						<Tooltip text="Close outline" side="right">
							<button
								class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-muted/50"
								@click="outlineOpen = false"
							>
								<X class="h-3 w-3" />
							</button>
						</Tooltip>
					</div>
					<div class="h-px bg-border" />

					<!-- Search input -->
					<div class="px-3 py-2.5 shrink-0">
						<div class="relative">
							<Search
								class="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none"
							/>
							<input
								v-model="outlineSearch"
								type="text"
								placeholder="Search outline..."
								class="w-full rounded-md border border-border/60 bg-muted/20 py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border focus:bg-background transition-colors"
							/>
							<button
								v-if="outlineSearch"
								class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
								@click="outlineSearch = ''"
							>
								<X class="h-3 w-3" />
							</button>
						</div>
					</div>
					<div class="h-px bg-border" />

					<!-- No results -->
					<div
						v-if="outlineSearch && filteredOutlineItems.length === 0"
						class="px-4 py-6 text-center"
					>
						<p class="text-xs text-muted-foreground/60">
							No items match "{{ outlineSearch }}"
						</p>
					</div>

					<!-- Outline nav -->
					<nav class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 outline-nav">
						<template
							v-for="item in filteredOutlineItems"
							:key="item.sectionId || item.lineNumber"
						>
						<!-- Document Text section: expandable -->
						<div
							v-if="item.sectionId === 'section-fulltext'"
							class="outline-section-item group flex items-center gap-1 w-full text-left text-[11px] font-semibold leading-snug text-foreground/80 hover:text-foreground py-1.5 px-2 rounded transition-colors hover:bg-muted/50 cursor-pointer"
							:title="item.text"
							@click="scrollToOutlineItem(item)"
						>
							<span class="truncate flex-1">{{ item.text }}</span>
							<button
								class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-muted hover:border-border/50"
								@click.stop="docTextOutlineExpanded = !docTextOutlineExpanded"
								:title="docTextOutlineExpanded ? 'Collapse headings' : 'Expand headings'"
							>
								<ChevronDown v-if="docTextOutlineExpanded" class="h-3 w-3 transition-transform" />
								<ChevronRight v-else class="h-3 w-3 transition-transform" />
							</button>
						</div>
							<!-- Other section items -->
							<button
								v-else-if="item.isSection"
								class="outline-section-item block w-full text-left text-[11px] font-semibold leading-snug text-foreground/80 hover:text-foreground py-1.5 px-2 rounded transition-colors truncate hover:bg-muted/50"
								:title="item.text"
								@click="scrollToOutlineItem(item)"
							>
								{{ item.text }}
							</button>
							<!-- Heading items (children of Document Text) -->
							<button
								v-else
								class="block w-full text-left text-[11px] leading-snug text-muted-foreground hover:text-foreground py-1 px-2 pl-5 rounded transition-colors truncate hover:bg-muted/50"
								:title="item.text"
								@click="scrollToOutlineItem(item)"
							>
								{{ item.text }}
							</button>
						</template>
					</nav>
				</aside>
				<!-- Outline resize handle -->
				<div
					v-if="outlineOpen && outlineItems.length > 0"
					class="outline-drag-handle shrink-0 hidden lg:flex z-10 sticky top-12 self-start h-[calc(100vh-3rem)]"
					@mousedown="onOutlineResizeStart"
				>
					<div class="h-full w-px bg-border" />
				</div>

				<!-- ── Main content area ── -->
				<div class="flex-1 min-w-0 xl:flex xl:flex-col xl:h-[calc(100vh-3rem)] xl:overflow-hidden">
					<!-- Document header -->
					<div
						class="sticky top-12 xl:relative xl:top-0 z-20 bg-background/95 backdrop-blur border-b border-border doc-header-shadow shrink-0"
					>
						<div class="px-6 sm:px-8 lg:px-10">
							<!-- Single row: back + title/meta + actions -->
							<div class="flex items-center gap-3 py-3">
								<!-- Back button -->
								<Tooltip text="Go back">
									<button
										class="group flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-muted/50"
										@click="goBack"
										aria-label="Go back"
									>
										<ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
									</button>
								</Tooltip>

								<!-- Title block -->
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-0.5">
										<Badge
											:variant="citation.source === 'HUDOC' ? 'default' : 'secondary'"
											class="text-[10px] h-4.5 px-1.5 shrink-0"
										>
											{{ citation.source === "HUDOC" ? "ECHR" : "Rechtspraak" }}
										</Badge>
										<span
											v-if="importanceLabel"
											class="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 shrink-0"
										>
											<Star class="h-2.5 w-2.5 fill-current" />
											{{ importanceLabel }}
										</span>
										<span
											v-if="citation.document_type"
											class="text-[9px] uppercase tracking-wider text-muted-foreground/40 shrink-0"
										>
											{{ citation.document_type }}
										</span>
									</div>
									<h1 class="text-sm font-semibold leading-snug text-foreground truncate" :title="citation.title || citation.ecli">
										{{ citation.title || citation.ecli }}
									</h1>
									<div class="flex items-center gap-1.5 mt-0.5">
										<code class="text-[10px] text-muted-foreground/50 font-mono leading-none truncate">{{ citation.ecli }}</code>
										<button
											class="shrink-0 text-muted-foreground/25 transition-colors hover:text-foreground"
											@click="copyEcli"
											title="Copy ECLI"
											aria-label="Copy ECLI"
										>
											<Check v-if="copied" class="h-2.5 w-2.5 text-emerald-500" />
											<Copy v-else class="h-2.5 w-2.5" />
										</button>
									</div>
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-0.5 shrink-0">
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
									<Tooltip text="Share with annotations">
										<button
											class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground hover:bg-muted/50"
											@click="shareWithAnnotations"
											aria-label="Share with annotations"
										>
											<Check v-if="shareCopied" class="h-3.5 w-3.5 text-emerald-500" />
											<Share2 class="h-3.5 w-3.5" v-else />
										</button>
									</Tooltip>
									<Tooltip text="Citation graph">
										<button
											class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-foreground hover:bg-muted/50"
											@click="router.push({ path: '/graph', query: { ecli } })"
											aria-label="Open citation graph"
										>
											<GitFork class="h-3.5 w-3.5" />
										</button>
									</Tooltip>
									<div class="w-px h-4 bg-border/50 mx-0.5" />
									<Tooltip :text="isSaved ? 'Unsave document' : 'Save document'">
										<button
											:class="[
												'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
												isSaved
													? 'text-primary bg-primary/10'
													: 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/50',
											]"
											@click="toggleSave"
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
														v-if="citation && userData.getDocsInFolder(folder.id).some(d => d.ecli === citation!.ecli)"
														class="h-3 w-3 text-primary shrink-0"
													/>
												</button>
											</template>
											<p v-else class="px-3 py-2 text-[10px] text-muted-foreground/40 italic">No folders yet. Create one from the Library sidebar.</p>
										</div>
									</div>
									<div class="w-px h-4 bg-border/50 mx-0.5" />
									<Tooltip v-if="fullTextContent && fullTextExpanded" text="Search in text (Ctrl+F)">
										<button
											:class="[
												'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
												textSearchOpen
													? 'text-primary bg-primary/10'
													: 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/50',
											]"
											@click="textSearchOpen ? closeTextSearch() : openTextSearch()"
											aria-label="Search in text"
										>
											<Search class="h-3.5 w-3.5" />
										</button>
									</Tooltip>
									<Tooltip v-if="outlineItems.length > 0 && fullTextExpanded" text="Document outline">
										<button
											:class="[
												'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
												outlineOpen
													? 'text-primary bg-primary/10'
													: 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/50',
											]"
											@click="outlineOpen = !outlineOpen"
											aria-label="Document outline"
										>
											<List class="h-3.5 w-3.5" />
										</button>
									</Tooltip>
								</div>
							</div>

							<!-- Text search bar (slide in) -->
							<Transition name="search-bar">
								<div v-if="textSearchOpen" class="flex items-center gap-2 pb-3">
									<div class="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs flex-1 max-w-sm">
										<Search class="h-3 w-3 text-muted-foreground/50 shrink-0" />
										<input
											ref="textSearchInputRef"
											v-model="textSearchQuery"
											type="text"
											placeholder="Search in document..."
											class="bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/40 flex-1 min-w-0"
											@keydown.enter.prevent="$event.shiftKey ? prevMatch() : nextMatch()"
											@keydown.escape="closeTextSearch"
										/>
										<span v-if="textSearchQuery.length >= 2" class="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
											{{ totalMatches > 0 ? `${textSearchIndex + 1}/${totalMatches}` : "0" }}
										</span>
									</div>
									<button class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30" @click="prevMatch" :disabled="totalMatches === 0" aria-label="Previous match">
										<ChevronUp class="h-3.5 w-3.5" />
									</button>
									<button class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30" @click="nextMatch" :disabled="totalMatches === 0" aria-label="Next match">
										<ChevronDown class="h-3.5 w-3.5" />
									</button>
									<button class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors" @click="closeTextSearch" aria-label="Close search">
										<X class="h-3 w-3" />
									</button>
								</div>
							</Transition>
						</div>
					</div>

					<!-- Main content -->
					<div class="w-full px-6 sm:px-8 lg:px-10 py-8 xl:flex-1 xl:min-h-0 xl:py-0 xl:pr-0">
					<div class="flex flex-col gap-8 xl:flex-row xl:gap-0 xl:h-full" data-doc-columns>
					<!-- ═══ Left column: main content ═══ -->
					<div class="flex-1 min-w-0 xl:overflow-y-auto xl:py-8 xl:pb-16 doc-column-scroll">
					<div class="doc-left-col-inner space-y-8">
						<!-- Shared annotations warning banner -->
						<Transition name="search-bar">
							<div
								v-if="sharedAnnotations && sharedAnnotationState === 'active'"
								class="rounded-lg border border-orange-300/60 dark:border-orange-500/30 bg-orange-50/80 dark:bg-orange-950/30 px-4 py-3"
							>
								<div class="flex items-start gap-3">
									<AlertTriangle class="h-4 w-4 text-orange-500 dark:text-orange-400 shrink-0 mt-0.5" />
									<div class="flex-1 min-w-0">
										<p class="text-xs font-medium text-orange-800 dark:text-orange-300 leading-relaxed">
											This link contains shared annotations from another user
										</p>
										<p class="text-[11px] text-orange-600/80 dark:text-orange-400/60 mt-0.5 leading-relaxed">
											{{ sharedAnnotations.highlights.length }} highlight{{ sharedAnnotations.highlights.length !== 1 ? 's' : '' }},
											{{ sharedAnnotations.comments.length }} comment{{ sharedAnnotations.comments.length !== 1 ? 's' : '' }}
											are overlaid on this document.
										</p>
										<div class="flex items-center gap-2 mt-2.5">
											<button
												class="rounded-md bg-orange-600 dark:bg-orange-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors"
												@click="saveSharedAnnotations"
											>
												Save to my annotations
											</button>
											<button
												class="rounded-md border border-orange-300/60 dark:border-orange-500/30 px-3 py-1 text-[11px] font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-100/60 dark:hover:bg-orange-900/30 transition-colors"
												@click="clearSharedAnnotations"
											>
												Clear
											</button>
											<button
												class="px-2 py-1 text-[11px] text-orange-500/70 dark:text-orange-400/50 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
												@click="ignoreSharedAnnotations"
											>
												Ignore
											</button>
										</div>
									</div>
									<button
										class="shrink-0 text-orange-400/60 hover:text-orange-600 dark:hover:text-orange-300 transition-colors"
										@click="clearSharedAnnotations"
										aria-label="Dismiss"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						</Transition>

						<!-- Saved confirmation -->
						<Transition name="search-bar">
							<div
								v-if="sharedAnnotationState === 'saved'"
								class="rounded-lg border border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-3"
							>
								<div class="flex items-center gap-3">
									<Check class="h-4 w-4 text-emerald-500 shrink-0" />
									<p class="text-xs font-medium text-emerald-700 dark:text-emerald-300 flex-1">
										<template v-if="sharedSavedCount > 0">
											{{ sharedSavedCount }} annotation{{ sharedSavedCount !== 1 ? 's' : '' }} saved to your library.
										</template>
										<template v-else>
											All shared annotations already exist in your library. Nothing new to save.
										</template>
									</p>
									<button
										class="shrink-0 text-emerald-400/60 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
										@click="sharedAnnotationState = 'cleared'"
										aria-label="Dismiss"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						</Transition>

						<!-- Document-wide comments (above summary) -->
						<section id="section-comments" class="scroll-mt-36 xl:scroll-mt-4">
							<div class="flex items-center gap-2 mb-3">
								<MessageSquare class="h-4 w-4 text-muted-foreground/60" />
								<div
									class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
								>
									Comments
								</div>
								<Badge
									v-if="docComments.length > 0"
									variant="secondary"
									class="text-[10px] h-4 px-1.5"
									>{{ docComments.length }}</Badge
								>
							</div>

							<!-- Document-level comments list -->
							<div v-if="docLevelComments.length > 0" class="space-y-2 mb-3">
								<div
									v-for="c in docLevelComments"
									:key="c.id"
									:class="[
										'rounded-lg border px-4 py-3',
										isSharedAnnotation(c.id)
											? 'border-orange-300/40 dark:border-orange-500/20 bg-orange-50/40 dark:bg-orange-950/20'
											: 'border-border/40 bg-background/80',
									]"
								>
									<template v-if="editingCommentId === c.id && !isSharedAnnotation(c.id)">
										<textarea
											v-model="editingCommentText"
											class="w-full rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-foreground outline-none resize-none focus:border-primary/40"
											rows="3"
											@keydown.ctrl.enter="saveEditComment"
											@keydown.escape="cancelEditComment"
										/>
										<div class="flex items-center gap-2 mt-2">
											<button
												class="text-[11px] text-primary hover:underline"
												@click="saveEditComment"
											>
												Save
											</button>
											<button
												class="text-[11px] text-muted-foreground hover:underline"
												@click="cancelEditComment"
											>
												Cancel
											</button>
										</div>
									</template>
									<template v-else>
										<p
											class="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed"
										>
											{{ c.text }}
										</p>
										<div
											class="flex items-center gap-2 mt-2 pt-2 border-t border-border/30"
										>
											<span v-if="isSharedAnnotation(c.id)" class="inline-flex items-center gap-1 text-[9px] font-medium text-orange-600 dark:text-orange-400 bg-orange-100/60 dark:bg-orange-900/30 rounded px-1.5 py-0.5">
												<Share2 class="h-2.5 w-2.5" /> Shared
											</span>
											<span v-else class="text-[10px] text-muted-foreground/40">{{
												formatCommentTime(c.createdAt)
											}}</span>
											<span
												v-if="!isSharedAnnotation(c.id) && c.updatedAt !== c.createdAt"
												class="text-[10px] text-muted-foreground/30 italic"
												>edited</span
											>
											<div class="flex-1" />
											<template v-if="!isSharedAnnotation(c.id)">
												<button
													class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/50 transition-colors"
													@click="startEditComment(c)"
													title="Edit"
												>
													<Pencil class="h-3 w-3" />
												</button>
												<button
													class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
													@click="deleteComment(c.id)"
													title="Delete"
												>
													<Trash2 class="h-3 w-3" />
												</button>
											</template>
										</div>
									</template>
								</div>
							</div>

							<!-- Always-visible Notion-style comment input -->
							<div
								class="doc-comment-input-row flex items-start gap-2.5"
								:class="{
									'doc-comment-input-focused':
										commentInputVisible && commentInputStartLine === undefined,
								}"
							>
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 mt-0.5"
								>
									<MessageSquare class="h-3 w-3 text-muted-foreground/40" />
								</div>
								<div class="flex-1 min-w-0">
									<textarea
										ref="commentInputRef"
										v-model="commentInputText"
										class="doc-comment-textarea w-full bg-transparent text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground/35 leading-relaxed"
										rows="1"
										placeholder="Add a comment..."
										@focus="
											commentInputStartLine = undefined;
											commentInputEndLine = undefined;
											commentInputVisible = true;
										"
										@keydown.ctrl.enter="submitDocComment"
										@keydown.meta.enter="submitDocComment"
										@keydown.escape="blurCommentInput"
									/>
									<!-- Action bar (visible when focused and has text) -->
									<Transition name="search-bar">
										<div
											v-if="
												commentInputVisible &&
												commentInputStartLine === undefined &&
												commentInputText.trim()
											"
											class="flex items-center gap-2 mt-1 pb-1"
										>
											<button
												class="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
												@click="submitDocComment"
											>
												Comment
											</button>
											<span class="text-[9px] text-muted-foreground/25"
												>Ctrl+Enter</span
											>
										</div>
									</Transition>
								</div>
							</div>

							<!-- Line-anchored comments summary (navigation) -->
							<div v-if="lineComments.length > 0" class="mt-3">
								<div class="text-[10px] text-muted-foreground/50 mb-2">
									Line comments
								</div>
								<div class="space-y-1">
									<button
										v-for="c in lineComments"
										:key="c.id"
										class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/40"
										@click="
											scrollToLine(c.startLine!);
											expandedCommentLines.add(c.startLine!);
										"
									>
										<MessageSquare
											:class="[
												'h-3 w-3 shrink-0',
												isSharedAnnotation(c.id) ? 'text-orange-400' : 'text-muted-foreground/40',
											]"
										/>
										<span
											class="text-muted-foreground/40 text-[10px] shrink-0 tabular-nums"
											>L{{ c.startLine
											}}{{
												c.endLine && c.endLine !== c.startLine
													? `–${c.endLine}`
													: ""
											}}</span
										>
										<span class="truncate text-foreground/60">{{
											c.text
										}}</span>
										<span v-if="isSharedAnnotation(c.id)" class="inline-flex items-center text-[8px] font-medium text-orange-500 dark:text-orange-400 shrink-0">shared</span>
									</button>
								</div>
							</div>
						</section>

						<div class="doc-divider h-px bg-border" />

						<!-- Summary / headnote -->
						<section v-if="inlineTextContent" id="section-summary">
							<div
								class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 scroll-mt-36 xl:scroll-mt-4"
							>
								Summary
							</div>
							<p class="text-sm leading-relaxed text-foreground/80">
								{{ inlineTextContent }}
							</p>
						</section>

						<div v-if="inlineTextContent" class="doc-divider h-px bg-border" />

						<!-- Metadata grid -->
						<section id="section-metadata">
							<div
								class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-4 scroll-mt-36 xl:scroll-mt-4"
							>
								Metadata
							</div>
							<div class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
								<div
									v-for="item in metadataItems"
									:key="item.label"
									class="flex items-start gap-2.5"
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
										<div
											class="text-sm font-medium text-foreground/90 truncate"
										>
											{{ item.value }}
										</div>
									</div>
								</div>

								<!-- Citations count -->
								<div class="flex items-start gap-2.5">
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
											{{ citedByCount }} Cited &middot; {{ citesCount }} Citing
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
								class="mt-6 space-y-4"
							>
								<div
									v-if="
										citation.article_violated &&
										citation.article_violated.length > 0
									"
								>
									<div
										class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
									>
										Articles Violated
									</div>
									<div class="flex flex-wrap gap-1.5">
										<Badge
											v-for="article in citation.article_violated"
											:key="article"
											variant="outline"
											class="text-xs bg-red-50/70 text-red-700 border-red-200/70 dark:bg-red-950/35 dark:text-red-200 dark:border-red-800/60"
											>Art. {{ article }}</Badge
										>
									</div>
								</div>
								<div
									v-if="
										citation.article_applied &&
										citation.article_applied.length > 0
									"
								>
									<div
										class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
									>
										Articles Applied
									</div>
									<div class="flex flex-wrap gap-1.5">
										<Badge
											v-for="article in citation.article_applied"
											:key="article"
											variant="outline"
											class="text-xs bg-blue-50/70 text-blue-700 border-blue-200/70 dark:bg-blue-950/35 dark:text-blue-200 dark:border-blue-800/60"
											>Art. {{ article }}</Badge
										>
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
									<div class="flex flex-wrap gap-1.5">
										<Badge
											v-for="article in citation.article_non_violated"
											:key="article"
											variant="outline"
											class="text-xs bg-emerald-50/70 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/35 dark:text-emerald-200 dark:border-emerald-800/60"
											>Art. {{ article }}</Badge
										>
									</div>
								</div>
							</div>

							<!-- Keywords -->
							<div
								v-if="citation.keywords && citation.keywords.length > 0"
								class="mt-6"
							>
								<div
									class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
								>
									Keywords
								</div>
								<div class="flex flex-wrap gap-1.5">
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
									citation.legal_provisions &&
									citation.legal_provisions.length > 0
								"
								class="mt-6"
							>
								<div
									class="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5"
								>
									Legal Provisions
								</div>
								<div class="flex flex-wrap gap-1.5">
									<Badge
										v-for="prov in citation.legal_provisions"
										:key="prov"
										variant="outline"
										class="text-xs"
										>{{ prov }}</Badge
									>
								</div>
							</div>
						</section>

						<div class="doc-divider h-px bg-border" />

						<!-- Full text -->
						<section id="section-fulltext">
							<button
								class="flex w-full items-center justify-between text-left scroll-mt-36 xl:scroll-mt-4"
								@click="toggleFullText"
							>
								<div class="flex items-center gap-2">
									<BookOpen class="h-4 w-4 text-muted-foreground/60" />
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
									<span
										v-if="parsedLines.length > 0 && fullTextExpanded"
										class="text-[10px] text-muted-foreground/40"
									>
										{{ parsedLines.length }} lines
									</span>
								</div>
								<ChevronDown
									v-if="!fullTextExpanded"
									class="h-4 w-4 text-muted-foreground/60"
								/>
								<ChevronUp v-else class="h-4 w-4 text-muted-foreground/60" />
							</button>

							<!-- Language selector -->
							<div
								v-if="fullTextExpanded && availableLanguages.length > 1"
								class="flex flex-wrap gap-1.5 mt-4"
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

							<div v-if="fullTextExpanded" class="mt-4">
								<!-- Loading -->
								<div
									v-if="fullTextLoading && !fullTextContent"
									class="flex items-center justify-center py-8"
								>
									<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
									<span class="ml-2 text-xs text-muted-foreground"
										>Loading full text...</span
									>
								</div>

								<!-- Error -->
								<div
									v-else-if="fullTextError && !fullTextContent"
									class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"
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

								<!-- Content with line numbers -->
								<div
									v-else-if="parsedLines.length > 0"
									ref="textContentRef"
									class="doc-text-container rounded-lg border border-border/50 bg-muted/15 overflow-x-auto relative"
									@mouseup="handleTextMouseUp"
								>
									<table class="doc-text-table w-full border-collapse">
										<tbody>
											<template
												v-for="line in parsedLines"
												:key="line.lineNumber"
											>
												<tr
													:id="`L${line.lineNumber}`"
													:class="[
														'doc-line group',
														line.isHeading ? 'doc-line-heading' : '',
														line.isEmpty ? 'doc-line-empty' : '',
														highlightedLine === line.lineNumber
															? 'doc-line-highlighted'
															: '',
														searchMatches.includes(line.lineNumber)
															? 'doc-line-search-match'
															: '',
														commentedLinesMap[line.lineNumber]
															? 'doc-line-commented'
															: '',
													]"
												>
													<td
														:class="[
															'doc-line-number',
															copiedLineNum === line.lineNumber
																? 'doc-line-number-copied'
																: '',
														]"
														@click="copyLineLink(line.lineNumber)"
													>
														<a
															:href="`#L${line.lineNumber}`"
															class="doc-line-number-link"
															@click.prevent="copyLineLink(line.lineNumber)"
														>
															<span class="doc-line-num-text">{{
																line.lineNumber
															}}</span>
															<span class="doc-line-link-icon">
																<Check
																	v-if="copiedLineNum === line.lineNumber"
																	class="h-3 w-3 text-emerald-500"
																/>
																<Link class="h-3 w-3" v-else />
															</span>
														</a>
													</td>
													<td class="doc-line-content">
														<!-- Always use renderLine for user highlights + search highlights -->
														<span v-html="renderLine(line)" />
														<span v-if="line.isEmpty">&nbsp;</span>
													</td>
													<!-- Gutter: highlight remove + comment indicator -->
													<td class="doc-line-gutter">
														<div class="flex items-center gap-0.5">
															<!-- Remove highlight button -->
															<button
																v-if="lineHasHighlight(line.lineNumber)"
																class="doc-gutter-btn doc-gutter-hl-remove"
																@click.stop="
																	removeLineHighlight(line.lineNumber)
																"
																title="Remove highlight"
															>
																<X class="h-2.5 w-2.5" />
															</button>
															<!-- Comment indicator -->
															<button
																v-if="lineCommentAnchorMap.has(line.lineNumber)"
																class="doc-gutter-btn doc-gutter-comment"
																@click.stop="toggleCommentLine(line.lineNumber)"
																:title="`${lineCommentAnchorMap.get(line.lineNumber)!.length} comment(s)`"
															>
																<MessageSquare class="h-2.5 w-2.5" />
																<span
																	v-if="
																		lineCommentAnchorMap.get(line.lineNumber)!
																			.length > 1
																	"
																	class="text-[8px] ml-0.5"
																>
																	{{
																		lineCommentAnchorMap.get(line.lineNumber)!
																			.length
																	}}
																</span>
															</button>
														</div>
													</td>
												</tr>
												<!-- Inline comments expansion -->
												<tr
													v-if="
														expandedCommentLines.has(line.lineNumber) &&
														lineCommentAnchorMap.has(line.lineNumber)
													"
												>
													<td></td>
													<td colspan="2" class="pb-2 pt-1 px-4">
														<div class="space-y-2">
															<div
																v-for="c in lineCommentAnchorMap.get(
																	line.lineNumber,
																)"
																:key="c.id"
																:class="[
																	'rounded-md border px-3 py-2',
																	isSharedAnnotation(c.id)
																		? 'border-orange-300/40 dark:border-orange-500/20 bg-orange-50/40 dark:bg-orange-950/20'
																		: 'border-border/50 bg-background/80',
																]"
															>
																<template v-if="editingCommentId === c.id && !isSharedAnnotation(c.id)">
																	<textarea
																		v-model="editingCommentText"
																		class="w-full rounded border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-foreground outline-none resize-none focus:border-primary/40"
																		rows="2"
																		@keydown.ctrl.enter="saveEditComment"
																		@keydown.escape="cancelEditComment"
																	/>
																	<div class="flex items-center gap-1.5 mt-1.5">
																		<button
																			class="text-[10px] text-primary hover:underline"
																			@click="saveEditComment"
																		>
																			Save
																		</button>
																		<button
																			class="text-[10px] text-muted-foreground hover:underline"
																			@click="cancelEditComment"
																		>
																			Cancel
																		</button>
																	</div>
																</template>
																<template v-else>
																	<p
																		class="text-xs text-foreground/80 whitespace-pre-wrap"
																	>
																		{{ c.text }}
																	</p>
																	<div class="flex items-center gap-2 mt-1.5">
																		<span v-if="isSharedAnnotation(c.id)" class="inline-flex items-center gap-0.5 text-[9px] font-medium text-orange-600 dark:text-orange-400 bg-orange-100/60 dark:bg-orange-900/30 rounded px-1 py-0.5">
																			<Share2 class="h-2 w-2" /> Shared
																		</span>
																		<span v-else
																			class="text-[10px] text-muted-foreground/40"
																			>{{
																				formatCommentTime(c.createdAt)
																			}}</span
																		>
																		<span
																			v-if="
																				c.endLine && c.endLine !== c.startLine
																			"
																			class="text-[10px] text-muted-foreground/30"
																			>L{{ c.startLine }}–{{ c.endLine }}</span
																		>
																		<div class="flex-1" />
																		<template v-if="!isSharedAnnotation(c.id)">
																			<button
																				class="text-muted-foreground/30 hover:text-foreground transition-colors"
																				@click="startEditComment(c)"
																				title="Edit"
																			>
																				<Pencil class="h-2.5 w-2.5" />
																			</button>
																			<button
																				class="text-muted-foreground/30 hover:text-destructive transition-colors"
																				@click="deleteComment(c.id)"
																				title="Delete"
																			>
																				<Trash2 class="h-2.5 w-2.5" />
																			</button>
																		</template>
																	</div>
																</template>
															</div>
														</div>
													</td>
												</tr>
												<!-- Inline comment editor (for line-anchored comments) -->
												<tr
													v-if="
														commentInputVisible &&
														commentInputStartLine !== undefined &&
														line.lineNumber ===
															(commentInputEndLine ?? commentInputStartLine)
													"
												>
													<td></td>
													<td colspan="2" class="px-4 py-2">
														<div
															class="rounded-lg border border-primary/20 bg-background p-3 shadow-sm"
														>
															<div
																class="text-[10px] text-muted-foreground/50 mb-2"
															>
																Comment on L{{ commentInputStartLine
																}}{{
																	commentInputEndLine &&
																	commentInputEndLine !== commentInputStartLine
																		? `–${commentInputEndLine}`
																		: ""
																}}
															</div>
															<textarea
																ref="commentInputRef"
																v-model="commentInputText"
																class="w-full rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-foreground outline-none resize-none placeholder:text-muted-foreground/30 focus:border-primary/40"
																rows="2"
																placeholder="Write a comment..."
																@keydown.ctrl.enter="submitComment"
																@keydown.meta.enter="submitComment"
																@keydown.escape="cancelComment"
															/>
															<div class="flex items-center gap-2 mt-2">
																<button
																	class="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
																	:disabled="!commentInputText.trim()"
																	@click="submitComment"
																>
																	Add
																</button>
																<button
																	class="rounded-md px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
																	@click="cancelComment"
																>
																	Cancel
																</button>
																<span
																	class="text-[9px] text-muted-foreground/30 ml-auto"
																	>Ctrl+Enter</span
																>
															</div>
														</div>
													</td>
												</tr>
											</template>
										</tbody>
									</table>

									<!-- Floating selection toolbar (create highlight / add comment) -->
									<Teleport to="body">
										<Transition name="toolbar-fade">
											<div
												v-if="selectionToolbar.visible"
												class="fixed z-50 flex items-center gap-1 rounded-lg border border-border/80 bg-popover px-2 py-1.5 shadow-xl"
												:style="{
													left: `${selectionToolbar.x}px`,
													top: `${selectionToolbar.y}px`,
													transform: 'translate(-50%, -100%)',
												}"
											>
												<button
													v-for="color in HIGHLIGHT_COLORS"
													:key="color.id"
													:class="[
														'h-5 w-5 rounded-full border-2 border-white/80 shadow-sm transition-transform hover:scale-110',
														color.class,
													]"
													:title="`Highlight ${color.label}`"
													@mousedown.prevent
													@click.stop="createHighlight(color.id)"
												/>
												<div class="w-px h-4 bg-border/60 mx-1" />
												<Tooltip text="Add comment">
													<button
														class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
														@mousedown.prevent
														@click.stop="startCommentFromSelection"
													>
														<MessageSquare class="h-3.5 w-3.5" />
													</button>
												</Tooltip>
											</div>
										</Transition>
									</Teleport>

									<!-- Floating edit toolbar (change color / remove existing highlight) -->
									<Teleport to="body">
										<Transition name="toolbar-fade">
											<div
												v-if="highlightEditToolbar.visible"
												class="fixed z-50 flex items-center gap-1 rounded-lg border border-border/80 bg-popover px-2 py-1.5 shadow-xl"
												:style="{
													left: `${highlightEditToolbar.x}px`,
													top: `${highlightEditToolbar.y}px`,
													transform: 'translate(-50%, -100%)',
												}"
											>
												<button
													v-for="color in HIGHLIGHT_COLORS"
													:key="color.id"
													:class="[
														'h-5 w-5 rounded-full border-2 shadow-sm transition-transform hover:scale-110',
														color.class,
														highlightEditToolbar.currentColor === color.id
															? 'border-foreground/50 ring-2 ring-foreground/15 scale-110'
															: 'border-white/80',
													]"
													:title="
														highlightEditToolbar.currentColor === color.id
															? color.label + ' (current)'
															: `Change to ${color.label}`
													"
													@mousedown.prevent
													@click.stop="changeHighlightColor(color.id)"
												/>
												<div class="w-px h-4 bg-border/60 mx-1" />
												<Tooltip text="Remove highlight">
													<button
														class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
														@mousedown.prevent
														@click.stop="removeHighlightFromToolbar"
													>
														<Trash2 class="h-3.5 w-3.5" />
													</button>
												</Tooltip>
											</div>
										</Transition>
									</Teleport>
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
						</section>
					</div>
					</div>

					<!-- ═══ Draggable divider between columns (xl only) ═══ -->
					<div
						v-if="(hasCitesSection || hasCitedBySection)"
						class="doc-col-drag-handle shrink-0 hidden xl:flex z-10"
						@mousedown="onCiteResizeStart"
					>
						<div class="h-full w-px bg-border" />
					</div>

					<!-- ═══ Right column: citations ═══ -->
					<div
						v-if="hasCitesSection || hasCitedBySection"
						class="doc-cite-column xl:shrink-0 xl:overflow-y-auto xl:py-8 xl:pb-16 xl:pl-6 xl:pr-10 doc-column-scroll"
						:style="{ '--cite-width': (citeWidthRatio * 100) + '%' }"
					>
						<div class="space-y-6">

						<!-- Citations Graph (collapsible, expanded by default) -->
						<section
							v-if="hasCitesSection || hasCitedBySection"
							id="section-citation-graph"
							class="scroll-mt-36 xl:scroll-mt-4"
						>
							<div
								class="flex items-center gap-2 cursor-pointer"
								@click="graphExpanded = !graphExpanded"
							>
								<div
									class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
								>
									Citations Graph
								</div>
								<Badge variant="secondary" class="text-[10px] h-4 px-1.5">{{
									citesCount + citedByCount
								}}</Badge>
								<div class="flex-1" />
								<Tooltip text="Open full-page graph">
									<button
										class="flex h-6 items-center gap-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors px-1.5 text-[9px]"
										@click.stop="router.push({ path: '/graph', query: { ecli } })"
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
							<div v-if="graphExpanded" class="mt-3">
								<ClientOnly>
									<CitationGraph
										v-if="citation"
										:root-ecli="ecli"
										:root-citation="citation"
										:cites-eclis="citesEclis"
										:cited-by-eclis="citedByEclis"
										:cited-docs="citedDocs"
										@navigate="(e: string) => router.push({ path: '/document', query: { ecli: e } })"
									/>
								</ClientOnly>
							</div>
						</section>

						<div v-if="hasCitesSection || hasCitedBySection" class="h-px bg-border xl:-ml-6 xl:-mr-10" />

						<!-- Cited Documents -->
						<section v-if="hasCitesSection" id="section-cited">
							<button
								class="flex w-full items-center justify-between text-left scroll-mt-36 xl:scroll-mt-4"
								@click="citesExpanded = !citesExpanded"
							>
								<div class="flex items-center gap-2">
									<div
										class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
									>
										Cited Documents
									</div>
									<Badge variant="secondary" class="text-[10px] h-4 px-1.5">{{
										citesCount
									}}</Badge>
								</div>
								<ChevronDown
									v-if="!citesExpanded"
									class="h-4 w-4 text-muted-foreground/60"
								/>
								<ChevronUp v-else class="h-4 w-4 text-muted-foreground/60" />
							</button>
							<div v-if="citesExpanded" class="mt-3 space-y-1.5">
								<template v-if="citesDocsList.length > 0">
									<button
										v-for="doc in citesDocsList"
										:key="doc.ecli"
										class="group flex w-full items-start gap-3 rounded-lg border border-border/40 bg-background/80 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
										@click="openCitedDocument(doc)"
									>
										<Badge
											:variant="
												doc.source === 'HUDOC' ? 'default' : 'secondary'
											"
											class="text-[10px] mt-0.5 shrink-0"
											>{{ doc.source === "HUDOC" ? "ECHR" : "RS" }}</Badge
										>
										<div class="min-w-0 flex-1">
											<div class="text-xs font-medium text-foreground truncate">
												{{ doc.title || doc.ecli }}
											</div>
											<code
												class="text-[10px] text-muted-foreground/70 font-mono"
												>{{ doc.ecli }}</code
											>
										</div>
										<ExternalLink
											class="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 mt-1"
										/>
									</button>
								</template>
								<template v-else-if="(citation.cites?.length ?? 0) > 0">
									<button
										v-for="e in citation.cites"
										:key="e"
										class="block w-full text-left text-xs font-mono text-primary/70 hover:text-primary truncate py-0.5"
										@click="openCitedDocument({ ecli: e, id: e } as Citation)"
									>
										{{ e }}
									</button>
								</template>
							</div>
						</section>

						<div v-if="hasCitesSection" class="h-px bg-border xl:-ml-6 xl:-mr-10" />

						<!-- Cited By -->
						<section v-if="hasCitedBySection" id="section-citedby">
							<button
								class="flex w-full items-center justify-between text-left scroll-mt-36 xl:scroll-mt-4"
								@click="citedByExpanded = !citedByExpanded"
							>
								<div class="flex items-center gap-2">
									<div
										class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
									>
										Cited By
									</div>
									<Badge variant="secondary" class="text-[10px] h-4 px-1.5">{{
										citedByCount
									}}</Badge>
								</div>
								<ChevronDown
									v-if="!citedByExpanded"
									class="h-4 w-4 text-muted-foreground/60"
								/>
								<ChevronUp v-else class="h-4 w-4 text-muted-foreground/60" />
							</button>
							<div v-if="citedByExpanded" class="mt-3 space-y-1.5">
								<template v-if="citedByDocsList.length > 0">
									<button
										v-for="doc in citedByDocsList"
										:key="doc.ecli"
										class="group flex w-full items-start gap-3 rounded-lg border border-border/40 bg-background/80 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
										@click="openCitedDocument(doc)"
									>
										<Badge
											:variant="
												doc.source === 'HUDOC' ? 'default' : 'secondary'
											"
											class="text-[10px] mt-0.5 shrink-0"
											>{{ doc.source === "HUDOC" ? "ECHR" : "RS" }}</Badge
										>
										<div class="min-w-0 flex-1">
											<div class="text-xs font-medium text-foreground truncate">
												{{ doc.title || doc.ecli }}
											</div>
											<code
												class="text-[10px] text-muted-foreground/70 font-mono"
												>{{ doc.ecli }}</code
											>
										</div>
										<ExternalLink
											class="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 mt-1"
										/>
									</button>
								</template>
								<template v-else-if="(citation.cited_by?.length ?? 0) > 0">
									<button
										v-for="e in citation.cited_by"
										:key="e"
										class="block w-full text-left text-xs font-mono text-primary/70 hover:text-primary truncate py-0.5"
										@click="openCitedDocument({ ecli: e, id: e } as Citation)"
									>
										{{ e }}
									</button>
								</template>
							</div>
						</section>

						</div>
					</div>

					</div>
					</div>
				</div>
			</div>
		</div>
		<AppFooter />
	</div>
</template>

<style scoped>
.doc-header-shadow {
	box-shadow:
		0 1px 3px 0 rgb(0 0 0 / 0.04),
		0 1px 2px -1px rgb(0 0 0 / 0.04);
}

/* ── Citations column width (xl+ only) ── */
@media (min-width: 1280px) {
	.doc-cite-column {
		flex-basis: var(--cite-width, 32%);
		max-width: var(--cite-width, 32%);
		min-width: 0;
	}
}

/* ── Column divider drag handle ── */
.doc-col-drag-handle {
	width: 5px;
	cursor: col-resize;
	display: flex;
	align-items: stretch;
	justify-content: center;
}

/* ── Independent column scrolling (xl+) ── */
.doc-column-scroll::-webkit-scrollbar {
	width: 4px;
}
.doc-column-scroll::-webkit-scrollbar-track {
	background: transparent;
}
.doc-column-scroll::-webkit-scrollbar-thumb {
	background-color: hsl(var(--border) / 0.5);
	border-radius: 4px;
}
.doc-column-scroll::-webkit-scrollbar-thumb:hover {
	background-color: hsl(var(--border));
}

/* ── Left column: constrain all children except dividers to max-w-4xl ── */
.doc-left-col-inner > :not(.doc-divider) {
	max-width: 56rem; /* 4xl */
	margin-left: auto;
	margin-right: auto;
}

/* ── Search bar transition ── */
.search-bar-enter-active,
.search-bar-leave-active {
	transition: all 0.15s ease;
}
.search-bar-enter-from,
.search-bar-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}

/* ── Outline slide transition (sidebar + drag handle appear/disappear) ── */

/* ── Outline sidebar ── */
.doc-outline-sidebar {
	min-width: 200px;
	max-width: 400px;
}

/* ── Outline drag handle ── */
.outline-drag-handle {
	width: 5px;
	cursor: col-resize;
	display: flex;
	align-items: stretch;
	justify-content: center;
}

/* ── Outline nav ── */
.outline-nav .outline-section-item + .outline-section-item {
	margin-top: 0.5rem;
}

.outline-nav .outline-section-item:first-child {
	margin-top: 0;
}

/* ── Document text table ── */
.doc-text-container {
	font-size: 13px;
	line-height: 1.7;
}

.doc-text-table {
	font-family:
		ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
		"Courier New", monospace;
}

.doc-line {
	transition: background-color 0.15s ease;
}

.doc-line:hover {
	background-color: hsl(var(--muted) / 0.3);
}

.doc-line-heading .doc-line-content {
	font-weight: 700;
	color: hsl(var(--foreground));
	padding-top: 0.75rem;
}

.doc-line-empty {
	height: 0.5em;
}

.doc-line-highlighted {
	background-color: hsl(var(--primary) / 0.08) !important;
}

.doc-line-search-match {
	background-color: hsla(50, 100%, 50%, 0.08);
}

.doc-line-commented {
	background-color: hsla(210, 100%, 60%, 0.1) !important;
}

.doc-line-commented:hover {
	background-color: hsla(210, 100%, 60%, 0.16) !important;
}

.doc-line-commented > .doc-line-number {
	border-left: 2px solid hsla(210, 100%, 60%, 0.45);
}

.doc-line-number {
	width: 1px;
	min-width: 3.5rem;
	padding: 0 0.5rem;
	text-align: right;
	vertical-align: top;
	user-select: none;
	white-space: nowrap;
	cursor: pointer;
	border-right: 1px solid hsl(var(--border) / 0.5);
}

.doc-line-number-link {
	display: inline-flex;
	align-items: center;
	justify-content: flex-end;
	font-size: 11px;
	color: hsl(var(--muted-foreground) / 0.3);
	text-decoration: none;
	transition: color 0.1s;
	font-variant-numeric: tabular-nums;
	min-width: 2.5rem;
}

.doc-line-link-icon {
	display: none;
}

.doc-line:hover .doc-line-num-text {
	display: none;
}

.doc-line:hover .doc-line-link-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.doc-line:hover .doc-line-number-link {
	color: hsl(var(--primary) / 0.6);
}

.doc-line-highlighted .doc-line-number-link {
	color: hsl(var(--primary));
}

/* Keep the check icon visible after copy even without hover */
.doc-line-number-copied .doc-line-link-icon {
	display: inline-flex !important;
	align-items: center;
	justify-content: center;
}

.doc-line-number-copied .doc-line-num-text {
	display: none !important;
}

.doc-line-content {
	padding: 0 1rem;
	color: hsl(var(--foreground) / 0.8);
	word-break: break-word;
	white-space: pre-wrap;
}

/* ── Search highlights ── */
:deep(.search-highlight) {
	background-color: hsla(50, 100%, 50%, 0.35);
	color: inherit;
	border-radius: 2px;
	padding: 0 1px;
}

/* ── Inline user highlights (word-level <mark> tags) ── */
:deep(.user-hl) {
	border-radius: 2px;
	padding: 0 1px;
}

:deep(.user-hl-yellow) {
	background-color: hsla(50, 100%, 50%, 0.35);
}

:deep(.user-hl-green) {
	background-color: hsla(140, 70%, 50%, 0.28);
}

:deep(.user-hl-blue) {
	background-color: hsla(210, 80%, 55%, 0.28);
}

:deep(.user-hl-pink) {
	background-color: hsla(330, 70%, 60%, 0.28);
}

:deep(.user-hl-orange) {
	background-color: hsla(25, 90%, 55%, 0.28);
}

/* ── Gutter column ── */
.doc-line-gutter {
	width: 1px;
	min-width: 2rem;
	padding: 0 0.25rem;
	vertical-align: top;
	user-select: none;
}

.doc-gutter-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 1px;
	border-radius: 3px;
	cursor: pointer;
	transition:
		color 0.1s,
		background-color 0.1s;
}

.doc-gutter-hl-remove {
	opacity: 0;
	color: hsl(var(--muted-foreground) / 0.3);
}

.doc-gutter-hl-remove:hover {
	color: hsl(var(--destructive));
	background-color: hsl(var(--destructive) / 0.1);
}

.doc-line:hover .doc-gutter-hl-remove {
	opacity: 1;
}

.doc-gutter-comment {
	color: hsl(var(--primary) / 0.5);
}

.doc-gutter-comment:hover {
	color: hsl(var(--primary));
	background-color: hsl(var(--primary) / 0.1);
}

/* ── Floating toolbar transition ── */
.toolbar-fade-enter-active,
.toolbar-fade-leave-active {
	transition: all 0.12s ease;
}
.toolbar-fade-enter-from,
.toolbar-fade-leave-to {
	opacity: 0;
	transform: translate(-50%, -100%) scale(0.95);
}

/* ── Notion-style comment input ── */
.doc-comment-input-row {
	padding: 0.5rem 0.75rem;
	border-radius: 0.5rem;
	border: 1px solid hsl(var(--border) / 0.4);
	transition:
		border-color 0.15s,
		box-shadow 0.15s;
}

.doc-comment-input-row:hover {
	border-color: hsl(var(--border) / 0.7);
}

.doc-comment-input-focused {
	border-color: hsl(var(--primary) / 0.3);
	box-shadow: 0 0 0 2px hsl(var(--primary) / 0.06);
}

.doc-comment-textarea {
	min-height: 1.5em;
	max-height: 12rem;
	overflow-y: auto;
	field-sizing: content;
}
</style>
