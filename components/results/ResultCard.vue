<script setup lang="ts">
import { computed } from "vue";
import { BookOpen, Star, ArrowUpRight } from "lucide-vue-next";
import Badge from "~/components/ui/badge/Badge.vue";
import type { Citation } from "~/lib/types";
import { formatDate, highlightText } from "~/lib/utils/utils";

const props = defineProps<{
	citation: Citation;
	query?: string;
	isSelected?: boolean;
	isChecked?: boolean;
}>();

const emit = defineEmits<{
	click: [];
	toggle: [];
}>();

const isEchr = computed(() => props.citation.source === "HUDOC");

const importanceLabel = computed(() => {
	const imp = props.citation.importance;
	if (imp === 1) return "Key case";
	if (imp === 2) return "Important";
	if (imp === 3) return "Moderate";
	return "";
});

const date = computed(
	() => props.citation.date || props.citation.date_judgment || "",
);

// Strip title from summary to avoid repetition
function cleanSummary(summary: string, title?: string): string {
	if (!summary) return "";
	let text = summary.trim();
	if (title) {
		const t = title.trim();
		if (t && text.startsWith(t)) {
			text = text
				.slice(t.length)
				.replace(/^[\s.;:,\-–—]+/, "")
				.trim();
		}
	}
	// Fix missing spaces after punctuation
	text = text
		.replace(/([.])([A-Za-z])/g, "$1 $2")
		.replace(/([;:!?])([A-Za-z0-9(])/g, "$1 $2")
		.replace(/([,])([A-Za-z(])/g, "$1 $2")
		.replace(/(\))([A-Za-z0-9(])/g, "$1 $2");
	return text;
}

const summaryText = computed(() =>
	cleanSummary(props.citation.summary, props.citation.title),
);
const summaryHtml = computed(() =>
	props.query && summaryText.value
		? highlightText(summaryText.value, props.query)
		: summaryText.value,
);

const citationCount = computed(
	() => (props.citation.nCited || 0) + (props.citation.nCiting || 0),
);
</script>

<template>
	<div
		:class="[
			'group relative rounded-lg border bg-card p-4 transition-all cursor-pointer hover:shadow-md',
			isSelected
				? 'border-primary ring-1 ring-primary/20 shadow-md'
				: 'border-border/60 hover:border-border',
		]"
		role="button"
		tabindex="0"
		@click="emit('click')"
		@keydown.enter="emit('click')"
	>
		<!-- Checkbox -->
		<div class="absolute top-4 left-4">
			<button
				:class="[
					'flex h-4 w-4 items-center justify-center rounded border transition-colors',
					isChecked
						? 'bg-primary border-primary'
						: 'border-input hover:border-primary/50',
				]"
				@click.stop="emit('toggle')"
			>
				<svg
					v-if="isChecked"
					class="h-3 w-3 text-primary-foreground"
					viewBox="0 0 12 12"
				>
					<path
						d="M10 3L4.5 8.5L2 6"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
				</svg>
			</button>
		</div>

		<div class="ml-7">
			<!-- Top: source badge + importance + citation count -->
			<div class="flex items-center gap-2 flex-wrap">
				<Badge
					:variant="isEchr ? 'default' : 'secondary'"
					class="text-[10px] shrink-0"
				>
					{{ isEchr ? "ECHR" : "Rechtspraak" }}
				</Badge>
				<span
					v-if="importanceLabel"
					class="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400"
				>
					<Star class="h-2.5 w-2.5 fill-current" />
					{{ importanceLabel }}
				</span>
				<span
					v-if="citation.document_type"
					class="text-[10px] text-muted-foreground/60"
				>
					{{ citation.document_type }}
				</span>
			</div>

			<!-- Title -->
			<h3 class="mt-1.5 text-sm font-semibold text-foreground line-clamp-1">
				{{ citation.title || citation.ecli }}
			</h3>

			<!-- ECLI + meta row -->
			<div
				class="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap"
			>
				<code class="font-mono text-[10px] text-muted-foreground/70">{{
					citation.ecli
				}}</code>
			</div>

			<div
				class="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap"
			>
				<span v-if="date">{{ formatDate(date) }}</span>
				<template v-if="citation.respondent_state">
					<span class="text-muted-foreground/30">&middot;</span>
					<span>{{ citation.respondent_state }}</span>
				</template>
				<template v-if="citation.instance && !isEchr">
					<span class="text-muted-foreground/30">&middot;</span>
					<span>{{ citation.instance }}</span>
				</template>
				<template v-if="citationCount > 0">
					<span class="text-muted-foreground/30">&middot;</span>
					<span class="inline-flex items-center gap-0.5">
						<BookOpen class="h-3 w-3" />
						{{ citationCount }} Citations
					</span>
				</template>
			</div>

			<!-- Summary -->
			<p
				v-if="summaryText"
				class="mt-2 text-xs leading-relaxed text-foreground/70 line-clamp-2"
				v-html="summaryHtml"
			/>

			<!-- Article badges (ECHR) -->
			<div
				v-if="
					isEchr &&
					citation.article_violated &&
					citation.article_violated.length > 0
				"
				class="mt-2.5 flex flex-wrap gap-1"
			>
				<Badge
					v-for="article in citation.article_violated.slice(0, 5)"
					:key="article"
					variant="outline"
					class="text-[10px] h-5 bg-red-50/70 text-red-700 border-red-200/70 dark:bg-red-950/35 dark:text-red-200 dark:border-red-800/60"
				>
					Art. {{ article }}
				</Badge>
				<Badge
					v-if="citation.article_violated.length > 5"
					variant="outline"
					class="text-[10px] h-5 text-muted-foreground"
				>
					+{{ citation.article_violated.length - 5 }} more
				</Badge>
			</div>

			<!-- Legal provisions (Rechtspraak) -->
			<div
				v-if="
					!isEchr &&
					citation.legal_provisions &&
					citation.legal_provisions.length > 0
				"
				class="mt-2.5 flex flex-wrap gap-1"
			>
				<span
					v-for="prov in citation.legal_provisions.slice(0, 3)"
					:key="prov"
					class="text-[10px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded"
				>
					{{ prov }}
				</span>
				<span
					v-if="citation.legal_provisions.length > 3"
					class="text-[10px] text-muted-foreground/50 px-1 py-0.5"
				>
					+{{ citation.legal_provisions.length - 3 }} more
				</span>
			</div>

			<!-- Keywords -->
			<div
				v-if="citation.keywords && citation.keywords.length > 0"
				class="mt-1.5 flex flex-wrap gap-1"
			>
				<span
					v-for="keyword in citation.keywords.slice(0, 4)"
					:key="keyword"
					class="text-[10px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded"
				>
					{{ keyword }}
				</span>
			</div>
		</div>
	</div>
</template>
