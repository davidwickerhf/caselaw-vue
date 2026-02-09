<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import LibrarySidebar from "~/components/shared/LibrarySidebar.vue";
import { useLibrary } from "~/composables/useLibrary";
import { type HistoryEntry } from "~/composables/useHistory";

const router = useRouter();
const {
	libraryOpen,
	libraryWidth,
	LIBRARY_MIN,
	LIBRARY_MAX,
	closeLibrary,
} = useLibrary();

// ── Resize logic ──
let resizing = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

function onResizeStart(event: MouseEvent) {
	event.preventDefault();
	resizing = true;
	resizeStartX = event.clientX;
	resizeStartWidth = libraryWidth.value;
	document.addEventListener("mousemove", onResizeMove);
	document.addEventListener("mouseup", onResizeEnd);
	document.body.style.cursor = "col-resize";
	document.body.style.userSelect = "none";
}

function onResizeMove(event: MouseEvent) {
	if (!resizing) return;
	const dx = event.clientX - resizeStartX;
	libraryWidth.value = Math.min(LIBRARY_MAX, Math.max(LIBRARY_MIN, resizeStartWidth + dx));
}

function onResizeEnd() {
	resizing = false;
	document.removeEventListener("mousemove", onResizeMove);
	document.removeEventListener("mouseup", onResizeEnd);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
}

function handleSelectSearch(entry: HistoryEntry) {
	closeLibrary();
	// Navigate to results with the search text
	if (entry.text?.trim()) {
		router.push({
			path: "/results",
			query: { searchString: entry.text.trim() },
		});
	}
}

function handleOpenDocument(ecli: string) {
	router.push({ path: "/document", query: { ecli } });
}

onBeforeUnmount(() => {
	document.removeEventListener("mousemove", onResizeMove);
	document.removeEventListener("mouseup", onResizeEnd);
});
</script>

<template>
	<Head>
		<Title>LegalSearch - ECHR &amp; Rechtspraak Document Search</Title>
	</Head>
	<div class="min-h-screen bg-background text-foreground flex flex-col">
		<!-- Wrapper: sidebar + page content side by side -->
		<div class="flex flex-1 min-h-0">
			<!-- Library sidebar panel (below header, above footer) -->
			<Transition name="library-slide">
				<aside
					v-if="libraryOpen"
					class="shrink-0 fixed top-12 bottom-0 left-0 z-20 bg-background overflow-hidden"
					:style="{ width: libraryWidth + 'px' }"
				>
					<LibrarySidebar
						@close="closeLibrary"
						@select-search="handleSelectSearch"
						@open-document="handleOpenDocument"
					/>
				</aside>
			</Transition>

			<!-- Resize handle -->
			<div
				v-if="libraryOpen"
				class="library-drag-handle fixed top-12 bottom-0 z-20"
				:style="{ left: libraryWidth + 'px' }"
				@mousedown="onResizeStart"
			>
				<div class="h-full w-px bg-border" />
			</div>

			<!-- Page content -->
			<div
				class="flex-1 min-w-0 flex flex-col transition-[margin] duration-200"
				:style="libraryOpen ? { marginLeft: (libraryWidth + 5) + 'px' } : {}"
			>
				<slot />
			</div>
		</div>
	</div>
</template>

<style scoped>
.library-drag-handle {
	width: 5px;
	cursor: col-resize;
	display: flex;
	align-items: stretch;
	justify-content: center;
}


.library-slide-enter-active,
.library-slide-leave-active {
	transition: width 0.2s ease, opacity 0.2s ease;
}

.library-slide-enter-from,
.library-slide-leave-to {
	width: 0 !important;
	opacity: 0;
}
</style>
