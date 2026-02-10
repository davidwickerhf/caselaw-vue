<script setup lang="ts">
import {
	ref,
	computed,
	watch,
	onMounted,
	onBeforeUnmount,
	nextTick,
	type PropType,
} from "vue";
import {
	forceSimulation,
	forceLink,
	forceManyBody,
	forceCenter,
	forceCollide,
	forceX,
	forceY,
	type SimulationNodeDatum,
	type SimulationLinkDatum,
} from "d3-force";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { select } from "d3-selection";
import type { Citation } from "~/lib/types";

/* ── Props ── */
const props = defineProps({
	rootEcli: { type: String, required: true },
	rootCitation: { type: Object as PropType<Citation>, default: null },
	citesEclis: {
		type: Set as unknown as PropType<Set<string>>,
		default: () => new Set(),
	},
	citedByEclis: {
		type: Set as unknown as PropType<Set<string>>,
		default: () => new Set(),
	},
	citedDocs: { type: Array as PropType<Citation[]>, default: () => [] },
	/** When true, the graph fills its container height instead of using a capped aspect ratio */
	fullPage: { type: Boolean, default: false },
});

const emit = defineEmits<{
	(e: "navigate", ecli: string): void;
}>();

/* ── Types ── */
interface GraphNode extends SimulationNodeDatum {
	id: string;
	ecli: string;
	label: string;
	source: string;
	year?: number;
	isRoot: boolean;
	docType?: string;
	/** 'cited' = root cites this doc, 'citing' = this doc cites root, 'both' = both directions */
	relation: 'root' | 'cited' | 'citing' | 'both';
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
	sourceId: string;
	targetId: string;
}

/* ── Refs ── */
const svgRef = ref<SVGSVGElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const width = ref(600);
const height = ref(400);

// Tooltip
const tooltip = ref<{
	visible: boolean;
	x: number;
	y: number;
	node: GraphNode | null;
}>({ visible: false, x: 0, y: 0, node: null });

// Simulation internals (kept outside Vue reactivity for performance)
let sim: ReturnType<typeof forceSimulation<GraphNode>> | null = null;
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
let simNodes: GraphNode[] = [];
let simLinks: (GraphLink & {
	source: GraphNode | string;
	target: GraphNode | string;
})[] = [];

// Reactive copies for rendering
const renderNodes = ref<GraphNode[]>([]);
const renderLinks = ref<{ sx: number; sy: number; tx: number; ty: number }[]>(
	[],
);
const transform = ref({ x: 0, y: 0, k: 1 });

// Drag state
let dragNode: GraphNode | null = null;

/* ── Build graph ── */
function buildGraph() {
	const nodeMap = new Map<string, GraphNode>();
	const edgeList: GraphLink[] = [];

	const rootLabel = props.rootCitation?.title
		? truncate(props.rootCitation.title, 30)
		: truncateEcli(props.rootEcli);

	nodeMap.set(props.rootEcli, {
		id: props.rootEcli,
		ecli: props.rootEcli,
		label: rootLabel,
		source: props.rootCitation?.source ?? "Unknown",
		year: props.rootCitation?.year,
		isRoot: true,
		docType: props.rootCitation?.document_type,
		relation: 'root',
	});

	// Pre-compute which ECLIs appear in both directions
	const isCited = new Set(props.citesEclis);
	const isCiting = new Set(props.citedByEclis);

	function ensureNode(ecli: string, rel: 'cited' | 'citing') {
		if (nodeMap.has(ecli)) {
			// Upgrade to 'both' if it appears in both directions
			const existing = nodeMap.get(ecli)!;
			if (existing.relation !== rel && existing.relation !== 'both' && existing.relation !== 'root') {
				existing.relation = 'both';
			}
			return;
		}
		const doc = props.citedDocs.find((d) => d.ecli === ecli);
		const bothDirs = isCited.has(ecli) && isCiting.has(ecli);
		nodeMap.set(ecli, {
			id: ecli,
			ecli,
			label: doc?.title ? truncate(doc.title, 25) : truncateEcli(ecli),
			source: doc?.source ?? guessSource(ecli),
			year: doc?.year,
			isRoot: false,
			docType: doc?.document_type,
			relation: bothDirs ? 'both' : rel,
		});
	}

	// root → cited (documents the root cites)
	for (const ecli of props.citesEclis) {
		ensureNode(ecli, 'cited');
		edgeList.push({
			source: props.rootEcli,
			target: ecli,
			sourceId: props.rootEcli,
			targetId: ecli,
		});
	}

	// citedBy → root (documents that cite the root)
	for (const ecli of props.citedByEclis) {
		ensureNode(ecli, 'citing');
		edgeList.push({
			source: ecli,
			target: props.rootEcli,
			sourceId: ecli,
			targetId: props.rootEcli,
		});
	}

	simNodes = Array.from(nodeMap.values());
	simLinks = edgeList.map((l) => ({
		...l,
		source: l.sourceId,
		target: l.targetId,
	})) as any;
}

/* ── Helpers ── */
function truncate(str: string, len: number): string {
	return str.length > len ? str.slice(0, len - 1) + "\u2026" : str;
}
function truncateEcli(ecli: string): string {
	const parts = ecli.split(":");
	if (parts.length >= 4) return parts.slice(-2).join(":");
	return ecli.length > 20 ? "\u2026" + ecli.slice(-18) : ecli;
}
function guessSource(ecli: string): string {
	return ecli.includes("CE:ECHR") ? "HUDOC" : "Rechtspraak";
}
function nodeColor(node: GraphNode): string {
	if (node.isRoot) return "#f97316"; // orange — current document
	if (node.relation === 'both') return "#a855f7"; // purple — both directions
	if (node.relation === 'cited') return "#6366f1"; // indigo — root cites this
	return "#10b981"; // emerald — this cites root
}
function nodeRadius(node: GraphNode): number {
	return node.isRoot ? 8 : 5;
}

/* ── Tick: push simulation state into reactive refs ── */
function tick() {
	renderNodes.value = simNodes.map((n) => ({ ...n }));
	renderLinks.value = simLinks.map((l) => {
		const s = typeof l.source === "string" ? null : (l.source as GraphNode);
		const t = typeof l.target === "string" ? null : (l.target as GraphNode);
		return {
			sx: s?.x ?? 0,
			sy: s?.y ?? 0,
			tx: t?.x ?? 0,
			ty: t?.y ?? 0,
		};
	});
}

/* ── Simulation init ── */
function initSimulation() {
	if (!svgRef.value) return;
	buildGraph();
	if (simNodes.length === 0) return;
	if (sim) sim.stop();

	const n = simNodes.length;

	// Scale spacing aggressively with node count
	let chargeStrength: number;
	let linkDist: number;
	let collideRadius: number;
	if (n > 200) {
		chargeStrength = -600;
		linkDist = 180;
		collideRadius = 25;
	} else if (n > 100) {
		chargeStrength = -500;
		linkDist = 150;
		collideRadius = 22;
	} else if (n > 50) {
		chargeStrength = -400;
		linkDist = 120;
		collideRadius = 18;
	} else if (n > 20) {
		chargeStrength = -300;
		linkDist = 100;
		collideRadius = 14;
	} else {
		chargeStrength = -250;
		linkDist = 90;
		collideRadius = 10;
	}

	sim = forceSimulation<GraphNode>(simNodes)
		.force(
			"link",
			forceLink(simLinks)
				.id((d: any) => d.id)
				.distance(linkDist),
		)
		.force("charge", forceManyBody().strength(chargeStrength).distanceMax(600))
		.force("center", forceCenter(width.value / 2, height.value / 2))
		.force(
			"collide",
			forceCollide<GraphNode>().radius((d) => nodeRadius(d) + collideRadius).strength(0.8),
		)
		.force("x", forceX(width.value / 2).strength(0.02))
		.force("y", forceY(height.value / 2).strength(0.02))
		.alphaDecay(0.015)
		.velocityDecay(0.3)
		.on("tick", tick);

	// Zoom via d3 (handles wheel + pan on SVG)
	zoomBehavior = zoom<SVGSVGElement, unknown>()
		.scaleExtent([0.05, 6])
		.on("zoom", (event) => {
			transform.value = {
				x: event.transform.x,
				y: event.transform.y,
				k: event.transform.k,
			};
		});
	const svgSel = select(svgRef.value);
	svgSel.call(zoomBehavior as any);
	// Prevent default double-click zoom
	svgSel.on("dblclick.zoom", null);

	// Set a useful default zoom for large networks — zoom in on center
	if (n > 30) {
		const defaultScale = n > 200 ? 2.5 : n > 100 ? 2 : 1.5;
		const cx = width.value / 2;
		const cy = height.value / 2;
		const tx = cx - cx * defaultScale;
		const ty = cy - cy * defaultScale;
		svgSel.call(
			(zoomBehavior as any).transform,
			zoomIdentity.translate(tx, ty).scale(defaultScale),
		);
	}
}

function zoomToFit() {
	if (!svgRef.value || !zoomBehavior || renderNodes.value.length === 0) return;

	// Compute bounding box of all nodes
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const n of renderNodes.value) {
		const x = n.x ?? 0;
		const y = n.y ?? 0;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}

	const padding = 40;
	const bw = maxX - minX + padding * 2;
	const bh = maxY - minY + padding * 2;
	const scale = Math.min(width.value / bw, height.value / bh, 3);
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	const tx = width.value / 2 - cx * scale;
	const ty = height.value / 2 - cy * scale;

	select(svgRef.value)
		.transition()
		.duration(500)
		.call(
			zoomBehavior.transform as any,
			zoomIdentity.translate(tx, ty).scale(scale),
		);
}

/* ── Drag via native mouse events ── */
function onNodePointerDown(event: PointerEvent, node: GraphNode) {
	// Find the sim node (same reference the simulation uses)
	const sn = simNodes.find((n) => n.id === node.id);
	if (!sn) return;

	event.stopPropagation();
	(event.target as Element)?.setPointerCapture?.(event.pointerId);

	dragNode = sn;
	sn.fx = sn.x;
	sn.fy = sn.y;
	sim?.alphaTarget(0.3).restart();
	tooltip.value.visible = false;
}

function onPointerMove(event: PointerEvent) {
	if (!dragNode || !svgRef.value) return;
	// Convert screen coords to graph coords accounting for zoom transform
	const t = transform.value;
	const rect = svgRef.value.getBoundingClientRect();
	const mx = (event.clientX - rect.left - t.x) / t.k;
	const my = (event.clientY - rect.top - t.y) / t.k;
	dragNode.fx = mx;
	dragNode.fy = my;
}

function onPointerUp() {
	if (!dragNode) return;
	sim?.alphaTarget(0);
	dragNode.fx = null;
	dragNode.fy = null;
	dragNode = null;
}

/* ── Node events ── */
function onNodeMouseEnter(event: MouseEvent, node: GraphNode) {
	if (dragNode) return; // don't show tooltip while dragging
	tooltip.value = {
		visible: true,
		x: event.clientX,
		y: event.clientY - 10,
		node,
	};
}
function onNodeMouseLeave() {
	tooltip.value.visible = false;
}
function onNodeClick(node: GraphNode) {
	if (node.isRoot) return;
	emit("navigate", node.ecli);
}

/* ── Tooltip citation lookup ── */
function getTooltipCitation(node: GraphNode): Citation | null {
	if (node.isRoot && props.rootCitation) return props.rootCitation;
	return props.citedDocs.find((d) => d.ecli === node.ecli) ?? null;
}

/* ── Arrow marker ── */
const markerId = `arrow-${Math.random().toString(36).slice(2, 8)}`;

/* ── Resize observer ── */
let resizeObs: ResizeObserver | null = null;
function updateSize() {
	if (!containerRef.value) return;
	const rect = containerRef.value.getBoundingClientRect();
	width.value = rect.width;
	height.value = props.fullPage
		? Math.max(400, rect.height)
		: Math.max(280, Math.min(rect.width * 0.55, 450));
}

onMounted(() => {
	updateSize();
	resizeObs = new ResizeObserver(() => updateSize());
	if (containerRef.value) resizeObs.observe(containerRef.value);
	nextTick(() => initSimulation());
	document.addEventListener("pointermove", onPointerMove);
	document.addEventListener("pointerup", onPointerUp);
});

onBeforeUnmount(() => {
	if (sim) sim.stop();
	if (resizeObs) resizeObs.disconnect();
	document.removeEventListener("pointermove", onPointerMove);
	document.removeEventListener("pointerup", onPointerUp);
});

watch(
	() => [props.rootEcli, props.citesEclis.size, props.citedByEclis.size],
	() => nextTick(() => initSimulation()),
);

watch([width, height], () => {
	if (sim) {
		sim
			.force("center", forceCenter(width.value / 2, height.value / 2))
			.force("x", forceX(width.value / 2).strength(0.02))
			.force("y", forceY(height.value / 2).strength(0.02))
			.alpha(0.3)
			.restart();
	}
});

/* ── Legend ── */
const colorLegend = computed(() => {
	const items: { color: string; label: string }[] = [
		{ color: "#f97316", label: "Current" },
	];
	const hasCited = renderNodes.value.some((n) => n.relation === 'cited');
	const hasCiting = renderNodes.value.some((n) => n.relation === 'citing');
	const hasBoth = renderNodes.value.some((n) => n.relation === 'both');
	if (hasCited) items.push({ color: "#6366f1", label: "Cited" });
	if (hasCiting) items.push({ color: "#10b981", label: "Cited by" });
	if (hasBoth) items.push({ color: "#a855f7", label: "Both" });
	return items;
});
const shapeLegend = computed(() => {
	const items: { shape: 'circle' | 'square'; label: string }[] = [];
	const hasECHR = renderNodes.value.some((n) => n.source === 'HUDOC');
	const hasRS = renderNodes.value.some((n) => n.source !== 'HUDOC');
	if (hasECHR) items.push({ shape: 'circle', label: 'ECHR' });
	if (hasRS) items.push({ shape: 'square', label: 'Rechtspraak' });
	return items;
});

const totalNodeCount = computed(() => renderNodes.value.length);
const totalEdgeCount = computed(() => renderLinks.value.length);

// Only show non-root labels when zoomed in enough — avoids visual clutter on large graphs
const labelZoomThreshold = computed(() => {
	const n = totalNodeCount.value;
	if (n > 200) return 3;
	if (n > 100) return 2.5;
	if (n > 50) return 2;
	if (n > 20) return 1.5;
	return 1;
});
</script>

<template>
	<div ref="containerRef" :class="['relative w-full select-none', fullPage ? 'h-full' : '']">
		<!-- Controls -->
		<div class="absolute top-2 right-2 z-10 flex items-center gap-1">
			<button
				class="flex h-6 items-center gap-1 rounded-md bg-background/80 backdrop-blur border border-border/40 text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors px-2 text-[9px]"
				@click="zoomToFit"
				title="Zoom to fit all nodes"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-3 w-3"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
				</svg>
				Fit
			</button>
		</div>

		<!-- Legend -->
		<div
			class="absolute bottom-2 left-2 z-10 flex flex-col gap-1 rounded-md bg-background/80 backdrop-blur border border-border/30 px-2.5 py-1.5"
		>
			<!-- Color = relation -->
			<div class="flex items-center gap-3">
				<div
					v-for="item in colorLegend"
					:key="item.label"
					class="flex items-center gap-1.5"
				>
					<span
						class="h-2.5 w-2.5 rounded-full shrink-0"
						:style="{ backgroundColor: item.color }"
					/>
					<span class="text-[9px] text-muted-foreground/60">{{
						item.label
					}}</span>
				</div>
			</div>
			<!-- Shape = source -->
			<div class="flex items-center gap-3">
				<div
					v-for="item in shapeLegend"
					:key="item.label"
					class="flex items-center gap-1.5"
				>
					<span
						v-if="item.shape === 'circle'"
						class="h-2.5 w-2.5 rounded-full shrink-0 border border-muted-foreground/40"
					/>
					<span
						v-else
						class="h-2.5 w-2.5 rounded-sm shrink-0 border border-muted-foreground/40"
					/>
					<span class="text-[9px] text-muted-foreground/60">{{
						item.label
					}}</span>
				</div>
				<span class="text-[9px] text-muted-foreground/30 ml-1">
					{{ totalNodeCount }} nodes &middot; {{ totalEdgeCount }} edges
				</span>
			</div>
		</div>

		<!-- SVG -->
		<svg
			ref="svgRef"
			:width="width"
			:height="height"
			class="w-full rounded-lg border border-border/30 bg-muted/10 cursor-grab active:cursor-grabbing"
			:viewBox="`0 0 ${width} ${height}`"
		>
			<defs>
				<marker
					:id="markerId"
					viewBox="0 0 10 10"
					refX="20"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
					class="fill-muted-foreground/25"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" />
				</marker>
			</defs>

			<g
				:transform="`translate(${transform.x}, ${transform.y}) scale(${transform.k})`"
			>
				<!-- Edges -->
				<line
					v-for="(link, i) in renderLinks"
					:key="`e-${i}`"
					:x1="link.sx"
					:y1="link.sy"
					:x2="link.tx"
					:y2="link.ty"
					class="stroke-muted-foreground/15"
					stroke-width="1"
					:marker-end="`url(#${markerId})`"
				/>

				<!-- Nodes -->
				<g
					v-for="node in renderNodes"
					:key="node.id"
					:transform="`translate(${node.x ?? 0}, ${node.y ?? 0})`"
					:class="{ 'cursor-pointer': !node.isRoot, 'cursor-grab': node.isRoot }"
					@pointerdown="onNodePointerDown($event, node)"
					@mouseenter="onNodeMouseEnter($event, node)"
					@mouseleave="onNodeMouseLeave"
					@click.stop="onNodeClick(node)"
				>
					<!-- ECHR nodes: circles -->
					<template v-if="node.source === 'HUDOC'">
						<!-- Glow for root -->
						<circle
							v-if="node.isRoot"
							:r="nodeRadius(node) + 4"
							:fill="nodeColor(node)"
							opacity="0.15"
						/>
						<circle
							class="graph-node"
							:r="nodeRadius(node)"
							:fill="nodeColor(node)"
							stroke="white"
							:stroke-width="node.isRoot ? 2 : 1"
							:opacity="node.isRoot ? 1 : 0.85"
						/>
					</template>
					<!-- Rechtspraak nodes: rounded squares -->
					<template v-else>
						<!-- Glow for root -->
						<rect
							v-if="node.isRoot"
							:x="-(nodeRadius(node) + 4)"
							:y="-(nodeRadius(node) + 4)"
							:width="(nodeRadius(node) + 4) * 2"
							:height="(nodeRadius(node) + 4) * 2"
							:rx="2"
							:fill="nodeColor(node)"
							opacity="0.15"
						/>
						<rect
							class="graph-node"
							:x="-nodeRadius(node)"
							:y="-nodeRadius(node)"
							:width="nodeRadius(node) * 2"
							:height="nodeRadius(node) * 2"
							:rx="2"
							:fill="nodeColor(node)"
							stroke="white"
							:stroke-width="node.isRoot ? 2 : 1"
							:opacity="node.isRoot ? 1 : 0.85"
						/>
					</template>
					<!-- Label (shown when zoomed in enough; threshold scales with node count) -->
					<text
						v-if="(node.isRoot && transform.k >= 1) || (!node.isRoot && transform.k >= labelZoomThreshold)"
						:y="nodeRadius(node) + 12"
						text-anchor="middle"
						class="fill-muted-foreground/50 select-none pointer-events-none"
						:font-size="node.isRoot ? 9 : 7"
						:font-weight="node.isRoot ? 600 : 400"
					>
						{{ node.label }}
					</text>
				</g>
			</g>
		</svg>

		<!-- Tooltip (teleported to body so it overlays everything) -->
		<Teleport to="body">
		<Transition name="tooltip-fade">
			<div
				v-if="tooltip.visible && tooltip.node"
				class="fixed z-9999 pointer-events-none rounded-lg border border-border/60 bg-popover shadow-xl px-3 py-2.5 max-w-[260px]"
				:style="{
					left: `${tooltip.x}px`,
					top: `${tooltip.y}px`,
					transform: 'translate(-50%, -100%)',
				}"
			>
				<div class="space-y-1">
					<div class="flex items-center gap-1.5">
						<span
							class="h-2 w-2 rounded-full shrink-0"
							:style="{ backgroundColor: nodeColor(tooltip.node) }"
						/>
						<span
							class="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50"
						>
							{{
								tooltip.node.source === "HUDOC"
									? "ECHR"
									: "Rechtspraak"
							}}
						</span>
						<span
							v-if="tooltip.node.isRoot"
							class="text-[8px] text-orange-500 font-semibold"
						>
							(current)
						</span>
						<span
							v-else
							:class="[
								'text-[8px] font-medium',
								tooltip.node.relation === 'cited' ? 'text-indigo-400' :
								tooltip.node.relation === 'citing' ? 'text-emerald-400' :
								'text-purple-400',
							]"
						>
							{{ tooltip.node.relation === 'cited' ? 'cited' : tooltip.node.relation === 'citing' ? 'cited by' : 'both' }}
						</span>
						<span
							v-if="tooltip.node.year"
							class="text-[9px] text-muted-foreground/30 ml-auto"
						>
							{{ tooltip.node.year }}
						</span>
					</div>
					<p class="text-[11px] font-medium text-foreground leading-snug">
						{{
							getTooltipCitation(tooltip.node)?.title ||
							tooltip.node.label
						}}
					</p>
					<code
						class="text-[9px] text-muted-foreground/40 font-mono block truncate"
					>
						{{ tooltip.node.ecli }}
					</code>
					<div
						v-if="getTooltipCitation(tooltip.node)"
						class="flex items-center gap-2 pt-0.5"
					>
						<span
							v-if="
								getTooltipCitation(tooltip.node)?.document_type
							"
							class="text-[8px] uppercase tracking-wider text-muted-foreground/30"
						>
							{{
								getTooltipCitation(tooltip.node)!.document_type
							}}
						</span>
						<span
							v-if="!tooltip.node.isRoot"
							class="text-[8px] text-primary/50"
						>
							Click to open
						</span>
					</div>
				</div>
			</div>
		</Transition>
		</Teleport>
	</div>
</template>

<style scoped>
g:hover > .graph-node {
	filter: brightness(1.2);
	transition: filter 0.15s ease;
}
</style>

<style>
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
	transition: opacity 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
	opacity: 0;
}
</style>
