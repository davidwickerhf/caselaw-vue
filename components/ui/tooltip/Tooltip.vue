<script setup lang="ts">
import {
	TooltipRoot,
	TooltipTrigger,
	TooltipPortal,
	TooltipContent,
	TooltipProvider,
} from "radix-vue";

withDefaults(
	defineProps<{
		text: string;
		side?: "top" | "bottom" | "left" | "right";
		sideOffset?: number;
		delayDuration?: number;
	}>(),
	{
		side: "bottom",
		sideOffset: 6,
		delayDuration: 300,
	},
);
</script>

<template>
	<TooltipProvider :delay-duration="delayDuration">
		<TooltipRoot>
			<TooltipTrigger as-child>
				<slot />
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent
					:side="side"
					:side-offset="sideOffset"
					class="tooltip-content z-50 rounded-md bg-foreground px-2.5 py-1 text-[11px] leading-none text-background shadow-md animate-in fade-in-0 zoom-in-95"
				>
					{{ text }}
				</TooltipContent>
			</TooltipPortal>
		</TooltipRoot>
	</TooltipProvider>
</template>

<style scoped>
.tooltip-content {
	animation-duration: 150ms;
}
</style>
