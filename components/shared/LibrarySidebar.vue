<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import {
	X,
	Search,
	Eye,
	Bookmark,
	FolderOpen,
	FolderPlus,
	Folder,
	Activity,
	ChevronRight,
	Trash2,
	Plus,
	Pencil,
	MoreHorizontal,
	FolderInput,
	FolderMinus,
	PanelLeftClose,
	Clock,
	Highlighter,
	MessageSquare,
	ChevronDown,
} from "lucide-vue-next";
import Badge from "~/components/ui/badge/Badge.vue";
import Tooltip from "~/components/ui/tooltip/Tooltip.vue";
import { useHistory, type HistoryEntry } from "~/composables/useHistory";
import {
	useUserData,
	type Folder as FolderType,
	type ActivityEntry,
	type Highlight,
	type DocComment,
} from "~/composables/useUserData";

const emit = defineEmits<{
	close: [];
	selectSearch: [entry: HistoryEntry];
	openDocument: [ecli: string];
}>();

const history = useHistory();
const userData = useUserData();

// ── Tab system ──
type Tab = "saved" | "searches" | "recent" | "activity";
const activeTab = ref<Tab>("saved");

const tabs: { id: Tab; label: string; icon: typeof Search; count?: () => number }[] = [
	{ id: "saved", label: "Saved", icon: Bookmark, count: () => userData.savedDocs.value.length },
	{ id: "searches", label: "Searches", icon: Clock, count: () => history.entries.value.length },
	{ id: "recent", label: "Viewed", icon: Eye, count: () => userData.recentDocs.value.length },
	{ id: "activity", label: "Activity", icon: Activity },
];

// ── Folders state ──
const expandedFolders = ref<Set<string>>(new Set());
const creatingFolder = ref(false);
const newFolderName = ref("");
const renamingFolderId = ref<string | null>(null);
const renameFolderName = ref("");
const folderMenuOpen = ref<string | null>(null);
const docMenuOpen = ref<string | null>(null);
const newFolderInputRef = ref<HTMLInputElement | null>(null);
const renameFolderInputRef = ref<HTMLInputElement | null>(null);

// ── Helpers ──
function formatTime(timestamp: number) {
	const diff = Date.now() - timestamp;
	if (diff < 60_000) return "Just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
	if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
	return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sourceBadge(source: string) {
	if (source === "HUDOC") return "ECHR";
	if (source === "Rechtspraak") return "RS";
	return source;
}

function handleOpenDocument(ecli: string) { emit("openDocument", ecli); }
function handleSelectSearch(entry: HistoryEntry) { emit("selectSearch", entry); }

// ── Folder CRUD ──
function toggleFolder(id: string) {
	const s = new Set(expandedFolders.value);
	s.has(id) ? s.delete(id) : s.add(id);
	expandedFolders.value = s;
}

function startCreateFolder() {
	creatingFolder.value = true;
	newFolderName.value = "";
	nextTick(() => newFolderInputRef.value?.focus());
}

function confirmCreateFolder() {
	const name = newFolderName.value.trim();
	if (!name) { creatingFolder.value = false; return; }
	const folder = userData.createFolder(name);
	expandedFolders.value = new Set([...expandedFolders.value, folder.id]);
	creatingFolder.value = false;
}

function startRenameFolder(folder: FolderType) {
	renamingFolderId.value = folder.id;
	renameFolderName.value = folder.name;
	folderMenuOpen.value = null;
	nextTick(() => renameFolderInputRef.value?.focus());
}

function confirmRenameFolder() {
	if (renamingFolderId.value && renameFolderName.value.trim()) {
		userData.renameFolder(renamingFolderId.value, renameFolderName.value.trim());
	}
	renamingFolderId.value = null;
}

function handleDeleteFolder(id: string) { userData.deleteFolder(id); folderMenuOpen.value = null; }
function handleAddToFolder(ecli: string, folderId: string) { userData.addDocumentToFolder(ecli, folderId); docMenuOpen.value = null; }
function handleRemoveFromFolder(ecli: string, folderId: string) { userData.removeDocumentFromFolder(ecli, folderId); }

const uncategorizedDocs = computed(() => userData.getUncategorizedDocs());

// ── Saved-tab sub-sections ──
type SavedSection = "folders" | "bookmarks" | "annotations";
const expandedSavedSections = ref<Set<SavedSection>>(new Set(["folders", "bookmarks", "annotations"]));

function toggleSavedSection(section: SavedSection) {
	const s = new Set(expandedSavedSections.value);
	s.has(section) ? s.delete(section) : s.add(section);
	expandedSavedSections.value = s;
}

// ── Annotations for sidebar listing ──
const allAnnotations = computed(() => userData.getAllAnnotations());

function isHighlight(a: Highlight | DocComment): a is Highlight {
	return 'color' in a;
}

function annotationTitle(ann: Highlight | DocComment): string {
	if (isHighlight(ann)) {
		return ann.text.length > 50 ? ann.text.slice(0, 50) + '…' : ann.text;
	}
	return ann.text.length > 50 ? ann.text.slice(0, 50) + '…' : ann.text;
}

function annotationLineLabel(ann: Highlight | DocComment): string {
	if (isHighlight(ann)) {
		return `L${ann.startLine}`;
	}
	if (ann.startLine !== undefined) {
		return `L${ann.startLine}${ann.endLine && ann.endLine !== ann.startLine ? `–${ann.endLine}` : ''}`;
	}
	return 'Doc';
}

const HIGHLIGHT_COLORS: Record<string, string> = {
	yellow: 'bg-yellow-400',
	green: 'bg-green-400',
	blue: 'bg-blue-400',
	pink: 'bg-pink-400',
	orange: 'bg-orange-400',
};

function activityIconFor(type: ActivityEntry["type"]) {
	switch (type) {
		case "search": return Search;
		case "view_document": return Eye;
		case "save_document": return Bookmark;
		case "unsave_document": return Trash2;
		case "create_folder": case "delete_folder": return Folder;
		case "add_to_folder": return FolderInput;
		case "remove_from_folder": return FolderMinus;
		case "add_highlight": case "remove_highlight": return Highlighter;
		case "add_comment": case "edit_comment": case "remove_comment": return MessageSquare;
		default: return Activity;
	}
}
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- ── Header ── -->
		<div class="flex items-center justify-between px-4 py-3 shrink-0">
			<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Library</span>
			<Tooltip text="Close" side="right">
				<button
					class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-muted/50"
					@click="emit('close')"
				>
					<PanelLeftClose class="h-3.5 w-3.5" />
				</button>
			</Tooltip>
		</div>

		<!-- ── Tabs ── -->
		<div class="flex shrink-0 px-3 pb-2.5">
			<button
				v-for="tab in tabs"
				:key="tab.id"
				:class="[
					'flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-medium transition-all',
					activeTab === tab.id
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/40',
				]"
				@click="activeTab = tab.id"
			>
				<component :is="tab.icon" class="h-3 w-3" />
				{{ tab.label }}
			</button>
		</div>

		<div class="h-px bg-border" />

		<!-- ── Scrollable content ── -->
		<div class="flex-1 overflow-y-auto min-h-0 sidebar-scroll">

			<!-- ═══════════════════ SAVED TAB ═══════════════════ -->
			<div v-if="activeTab === 'saved'" class="py-1">

				<!-- ── Sub-section: Folders ── -->
				<div>
					<button
						class="flex w-full items-center gap-1.5 px-4 py-2 text-left hover:bg-muted/30 transition-colors"
						@click="toggleSavedSection('folders')"
					>
						<ChevronDown :class="['h-3 w-3 text-muted-foreground/40 transition-transform duration-150 shrink-0', expandedSavedSections.has('folders') ? '' : '-rotate-90']" />
						<Folder class="h-3 w-3 text-muted-foreground/50 shrink-0" />
						<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">Folders</span>
						<span class="text-[10px] tabular-nums text-muted-foreground/35">{{ userData.foldersCount.value }}</span>
					</button>

					<div v-if="expandedSavedSections.has('folders')">
						<!-- Folders list -->
						<div v-if="userData.folders.value.length > 0" class="px-2 space-y-px">
							<div v-for="folder in userData.folders.value" :key="folder.id">
								<div class="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors">
									<button class="flex items-center gap-1.5 flex-1 min-w-0 text-left" @click="toggleFolder(folder.id)">
										<ChevronRight
											:class="['h-3 w-3 text-muted-foreground/40 transition-transform duration-150 shrink-0', expandedFolders.has(folder.id) ? 'rotate-90' : '']"
										/>
										<FolderOpen v-if="expandedFolders.has(folder.id)" class="h-3.5 w-3.5 text-primary/70 shrink-0" />
										<Folder v-else class="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
										<template v-if="renamingFolderId === folder.id">
											<input
												ref="renameFolderInputRef"
												v-model="renameFolderName"
												class="flex-1 min-w-0 rounded border border-border/60 bg-muted/20 px-1.5 py-0.5 text-[12px] text-foreground outline-none focus:border-primary/40"
												@keydown.enter="confirmRenameFolder"
												@keydown.escape="renamingFolderId = null"
												@blur="confirmRenameFolder"
											/>
										</template>
										<template v-else>
											<span class="truncate text-[12px] font-medium text-foreground/80">{{ folder.name }}</span>
										</template>
									</button>
									<span class="text-[10px] tabular-nums text-muted-foreground/40 shrink-0 mr-0.5">
										{{ userData.getDocsInFolder(folder.id).length }}
									</span>
									<div class="relative">
										<button
											class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60"
											@click.stop="folderMenuOpen = folderMenuOpen === folder.id ? null : folder.id"
										>
											<MoreHorizontal class="h-3 w-3" />
										</button>
										<div
											v-if="folderMenuOpen === folder.id"
											class="absolute right-0 top-6 z-30 w-32 rounded-lg border border-border/80 bg-popover shadow-xl py-1"
										>
											<button class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors" @click="startRenameFolder(folder)">
												<Pencil class="h-3 w-3 text-muted-foreground/60" /> Rename
											</button>
											<button class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 transition-colors" @click="handleDeleteFolder(folder.id)">
												<Trash2 class="h-3 w-3" /> Delete
											</button>
										</div>
									</div>
								</div>

								<!-- Folder contents -->
								<div v-if="expandedFolders.has(folder.id)" class="ml-[1.6rem] border-l border-border/40 pl-2 space-y-px mt-0.5 mb-1">
									<template v-if="userData.getDocsInFolder(folder.id).length > 0">
										<div
											v-for="doc in userData.getDocsInFolder(folder.id)"
											:key="doc.ecli"
											class="group/doc flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-colors hover:bg-muted/40"
											@click="handleOpenDocument(doc.ecli)"
										>
											<Badge :variant="doc.source === 'HUDOC' ? 'default' : 'secondary'" class="text-[8px] h-3.5 px-1 shrink-0">{{ sourceBadge(doc.source) }}</Badge>
											<span class="truncate text-[11px] text-foreground/70 flex-1">{{ doc.title || doc.ecli }}</span>
											<button
												class="shrink-0 opacity-0 group-hover/doc:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all"
												@click.stop="handleRemoveFromFolder(doc.ecli, folder.id)"
											>
												<X class="h-2.5 w-2.5" />
											</button>
										</div>
									</template>
									<p v-else class="px-2 py-1.5 text-[10px] text-muted-foreground/40 italic">No documents</p>
								</div>
							</div>
						</div>

						<!-- New folder button / input -->
						<div class="px-2 mt-1 mb-1">
							<div v-if="creatingFolder" class="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
								<FolderPlus class="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
								<input
									ref="newFolderInputRef"
									v-model="newFolderName"
									placeholder="Folder name..."
									class="flex-1 min-w-0 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/30"
									@keydown.enter="confirmCreateFolder"
									@keydown.escape="creatingFolder = false"
									@blur="confirmCreateFolder"
								/>
							</div>
							<button
								v-else
								class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
								@click="startCreateFolder"
							>
								<Plus class="h-3 w-3" /> New folder
							</button>
						</div>
					</div>
				</div>

				<div class="h-px bg-border" />

				<!-- ── Sub-section: Bookmarks ── -->
				<div>
					<button
						class="flex w-full items-center gap-1.5 px-4 py-2 text-left hover:bg-muted/30 transition-colors"
						@click="toggleSavedSection('bookmarks')"
					>
						<ChevronDown :class="['h-3 w-3 text-muted-foreground/40 transition-transform duration-150 shrink-0', expandedSavedSections.has('bookmarks') ? '' : '-rotate-90']" />
						<Bookmark class="h-3 w-3 text-muted-foreground/50 shrink-0" />
						<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">Bookmarks</span>
						<span class="text-[10px] tabular-nums text-muted-foreground/35">{{ uncategorizedDocs.length }}</span>
					</button>

					<div v-if="expandedSavedSections.has('bookmarks')">
						<div v-if="uncategorizedDocs.length > 0" class="px-2 space-y-px pb-1">
							<div
								v-for="doc in uncategorizedDocs"
								:key="doc.ecli"
								class="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
							>
								<button class="flex items-center gap-2 flex-1 min-w-0 text-left" @click="handleOpenDocument(doc.ecli)">
									<Badge :variant="doc.source === 'HUDOC' ? 'default' : 'secondary'" class="text-[8px] h-3.5 px-1 shrink-0">{{ sourceBadge(doc.source) }}</Badge>
									<span class="truncate text-[11px] text-foreground/70">{{ doc.title || doc.ecli }}</span>
								</button>
								<div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
									<div class="relative">
										<button
											class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/60"
											@click.stop="docMenuOpen = docMenuOpen === doc.ecli ? null : doc.ecli"
										>
											<FolderInput class="h-3 w-3" />
										</button>
										<div
											v-if="docMenuOpen === doc.ecli"
											class="absolute right-0 top-6 z-30 w-40 rounded-lg border border-border/80 bg-popover shadow-xl py-1"
										>
											<div class="px-3 py-1 text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Move to</div>
											<button
												v-for="folder in userData.folders.value"
												:key="folder.id"
												class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors"
												@click.stop="handleAddToFolder(doc.ecli, folder.id)"
											>
												<Folder class="h-3 w-3 text-muted-foreground/50" /> {{ folder.name }}
											</button>
											<p v-if="userData.folders.value.length === 0" class="px-3 py-1.5 text-[10px] text-muted-foreground/40 italic">Create a folder first</p>
										</div>
									</div>
									<button
										class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10"
										@click.stop="userData.unsaveDocument(doc.ecli)"
									>
										<Trash2 class="h-2.5 w-2.5" />
									</button>
								</div>
							</div>
						</div>
						<div v-else class="px-4 py-4 text-center">
							<p class="text-[10px] text-muted-foreground/35 italic">No unfiled bookmarks</p>
						</div>
					</div>
				</div>

				<div class="h-px bg-border" />

				<!-- ── Sub-section: Annotations ── -->
				<div>
					<button
						class="flex w-full items-center gap-1.5 px-4 py-2 text-left hover:bg-muted/30 transition-colors"
						@click="toggleSavedSection('annotations')"
					>
						<ChevronDown :class="['h-3 w-3 text-muted-foreground/40 transition-transform duration-150 shrink-0', expandedSavedSections.has('annotations') ? '' : '-rotate-90']" />
						<Highlighter class="h-3 w-3 text-muted-foreground/50 shrink-0" />
						<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">Annotations</span>
						<span class="text-[10px] tabular-nums text-muted-foreground/35">{{ userData.annotationsCount.value }}</span>
					</button>

					<div v-if="expandedSavedSections.has('annotations')">
						<div v-if="allAnnotations.length > 0" class="px-2 space-y-px pb-1">
							<button
								v-for="ann in allAnnotations"
								:key="ann.id"
								class="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
								@click="handleOpenDocument(ann.ecli)"
							>
								<!-- Highlight color dot / comment icon -->
								<template v-if="isHighlight(ann)">
									<span :class="['h-2.5 w-2.5 rounded-full shrink-0 mt-1', HIGHLIGHT_COLORS[ann.color] || 'bg-yellow-400']" />
								</template>
								<template v-else>
									<MessageSquare class="h-3 w-3 text-muted-foreground/40 shrink-0 mt-0.5" />
								</template>

								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-1.5">
										<span class="text-[9px] tabular-nums text-muted-foreground/40 shrink-0">{{ annotationLineLabel(ann) }}</span>
										<span v-if="isHighlight(ann)" class="text-[10px] text-muted-foreground/30">highlight</span>
										<span v-else class="text-[10px] text-muted-foreground/30">comment</span>
									</div>
									<span class="block truncate text-[11px] text-foreground/70 mt-0.5 leading-snug">"{{ annotationTitle(ann) }}"</span>
									<div class="flex items-center gap-1.5 mt-0.5">
										<code class="text-[9px] text-muted-foreground/25 font-mono truncate">{{ ann.ecli }}</code>
										<span class="text-[10px] text-muted-foreground/25 shrink-0">&middot; {{ formatTime(ann.createdAt) }}</span>
									</div>
								</div>

								<!-- Delete -->
								<span
									class="shrink-0 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
									@click.stop="isHighlight(ann) ? userData.removeHighlight(ann.id) : userData.removeComment(ann.id)"
								>
									<Trash2 class="h-2.5 w-2.5" />
								</span>
							</button>
						</div>
						<div v-else class="px-4 py-4 text-center">
							<p class="text-[10px] text-muted-foreground/35 italic">No annotations yet</p>
							<p class="text-[9px] text-muted-foreground/25 mt-0.5">Highlight text or add comments on documents</p>
						</div>
					</div>
				</div>

				<!-- Global empty state (only if nothing at all) -->
				<div v-if="userData.savedDocs.value.length === 0 && userData.folders.value.length === 0 && allAnnotations.length === 0" class="flex flex-col items-center justify-center py-10 px-6 text-center">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 mb-3">
						<Bookmark class="h-5 w-5 text-muted-foreground/30" />
					</div>
					<p class="text-[12px] font-medium text-muted-foreground/50">No saved data</p>
					<p class="text-[10px] text-muted-foreground/30 mt-1 leading-relaxed">
						Bookmark documents, create folders,<br />or annotate text to get started
					</p>
				</div>
			</div>

			<!-- ═══════════════════ RECENT SEARCHES ═══════════════════ -->
			<div v-if="activeTab === 'searches'" class="py-2">
				<div v-if="history.entries.value.length > 0">
					<div class="flex items-center justify-between px-4 mb-1.5">
						<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">Recent</span>
						<button class="text-[10px] text-muted-foreground/30 hover:text-destructive transition-colors" @click="history.clear()">Clear</button>
					</div>
					<div class="px-2 space-y-px">
						<button
							v-for="entry in history.entries.value"
							:key="entry.id"
							class="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/40"
							@click="handleSelectSearch(entry)"
						>
							<Search class="h-3 w-3 text-muted-foreground/30 shrink-0 group-hover:text-primary/60 transition-colors" />
							<div class="flex-1 min-w-0">
								<span class="block truncate text-[12px] text-foreground/75">{{ entry.text || "Advanced search" }}</span>
								<span class="flex items-center gap-1.5 mt-0.5">
									<span v-if="entry.resultCount !== undefined" class="text-[10px] text-muted-foreground/40 tabular-nums">{{ entry.resultCount }} results</span>
									<span class="text-[10px] text-muted-foreground/30">{{ formatTime(entry.timestamp) }}</span>
								</span>
							</div>
						</button>
					</div>
				</div>
				<div v-else class="flex flex-col items-center justify-center py-16 px-6 text-center">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 mb-3">
						<Search class="h-5 w-5 text-muted-foreground/30" />
					</div>
					<p class="text-[12px] font-medium text-muted-foreground/50">No recent searches</p>
					<p class="text-[10px] text-muted-foreground/30 mt-1">Your search history will appear here</p>
				</div>
			</div>

			<!-- ═══════════════════ RECENTLY VIEWED ═══════════════════ -->
			<div v-if="activeTab === 'recent'" class="py-2">
				<div v-if="userData.recentDocs.value.length > 0">
					<div class="flex items-center justify-between px-4 mb-1.5">
						<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">Recently viewed</span>
						<button class="text-[10px] text-muted-foreground/30 hover:text-destructive transition-colors" @click="userData.clearRecentDocs()">Clear</button>
					</div>
					<div class="px-2 space-y-px">
						<button
							v-for="doc in userData.recentDocs.value"
							:key="doc.ecli"
							class="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/40"
							@click="handleOpenDocument(doc.ecli)"
						>
							<Badge :variant="doc.source === 'HUDOC' ? 'default' : 'secondary'" class="text-[8px] h-3.5 px-1 shrink-0">{{ sourceBadge(doc.source) }}</Badge>
							<div class="flex-1 min-w-0">
								<span class="block truncate text-[12px] text-foreground/75">{{ doc.title || doc.ecli }}</span>
								<div class="flex items-center gap-1.5 mt-0.5">
									<code class="text-[9px] text-muted-foreground/35 font-mono truncate">{{ doc.ecli }}</code>
									<span class="text-[10px] text-muted-foreground/30 shrink-0">&middot; {{ formatTime(doc.viewedAt) }}</span>
								</div>
							</div>
						</button>
					</div>
				</div>
				<div v-else class="flex flex-col items-center justify-center py-16 px-6 text-center">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 mb-3">
						<Eye class="h-5 w-5 text-muted-foreground/30" />
					</div>
					<p class="text-[12px] font-medium text-muted-foreground/50">No viewed documents</p>
					<p class="text-[10px] text-muted-foreground/30 mt-1">Documents you open will appear here</p>
				</div>
			</div>

			<!-- ═══════════════════ ACTIVITY ═══════════════════ -->
			<div v-if="activeTab === 'activity'" class="py-2">
				<div v-if="userData.activity.value.length > 0">
					<div class="flex items-center justify-between px-4 mb-1.5">
						<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">Activity</span>
						<button class="text-[10px] text-muted-foreground/30 hover:text-destructive transition-colors" @click="userData.clearActivity()">Clear</button>
					</div>
					<div class="px-2 space-y-px">
						<div
							v-for="entry in userData.activity.value"
							:key="entry.id"
							class="flex items-start gap-2.5 rounded-md px-2 py-1.5"
						>
							<div class="flex h-5 w-5 items-center justify-center rounded bg-muted/40 shrink-0 mt-0.5">
								<component :is="activityIconFor(entry.type)" class="h-2.5 w-2.5 text-muted-foreground/50" />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-[11px] text-foreground/65 truncate leading-snug">{{ entry.label }}</p>
								<span class="text-[10px] text-muted-foreground/30">{{ formatTime(entry.timestamp) }}</span>
							</div>
						</div>
					</div>
				</div>
				<div v-else class="flex flex-col items-center justify-center py-16 px-6 text-center">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 mb-3">
						<Activity class="h-5 w-5 text-muted-foreground/30" />
					</div>
					<p class="text-[12px] font-medium text-muted-foreground/50">No activity yet</p>
					<p class="text-[10px] text-muted-foreground/30 mt-1">Your actions will be logged here</p>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.sidebar-scroll::-webkit-scrollbar {
	width: 4px;
}
.sidebar-scroll::-webkit-scrollbar-track {
	background: transparent;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
	background-color: hsl(var(--border) / 0.5);
	border-radius: 4px;
}
.sidebar-scroll::-webkit-scrollbar-thumb:hover {
	background-color: hsl(var(--border));
}
</style>
