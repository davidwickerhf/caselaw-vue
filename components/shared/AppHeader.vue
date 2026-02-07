<script setup lang="ts">
import { computed } from "vue";
import { Scale, Moon, Sun } from "lucide-vue-next";

const props = defineProps<{
	fixed?: boolean;
}>();

const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === "dark");
const headerClasses = computed(() => [
	"border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
	props.fixed ? "fixed top-0 inset-x-0 z-40" : "",
]);

function toggleMode() {
	colorMode.value = isDark.value ? "light" : "dark";
}
</script>

<template>
	<header :class="headerClasses">
		<div class="mx-auto flex h-12 items-center justify-between px-0">
			<div class="flex flex-row h-full justify-between w-full">
				<NuxtLink
					to="/"
					class="flex items-center gap-2 font-semibold tracking-tight text-foreground ml-4"
				>
					<Scale class="h-4 w-4 text-primary" />
					<span class="text-sm">LegalSearch</span>
				</NuxtLink>

				<div class="flex items-center">
					<nav
						class="flex items-center gap-5 pr-4 text-sm text-muted-foreground"
					>
						<NuxtLink
							to="/examples"
							class="hover:text-foreground transition-colors"
						>
							Examples
						</NuxtLink>
						<NuxtLink
							to="/framework"
							class="hover:text-foreground transition-colors"
						>
							Framework
						</NuxtLink>
						<NuxtLink
							to="/"
							target="_blank"
							rel="noopener"
							class="hover:text-foreground transition-colors"
						>
							New Search
						</NuxtLink>
					</nav>
				</div>
			</div>

			<div class="flex flex-row h-full">
				<div class="w-px h-full bg-border" />
				<button
					class="group flex h-full w-12 shrink-0 items-center justify-center px-0 text-sm font-semibold text-muted-foreground transition-all duration-200 ease-out hover:text-foreground hover:bg-muted/40 active:scale-[0.98]"
					@click="toggleMode"
				>
					<Sun
						v-if="isDark"
						class="h-4 w-4 transition-transform group-hover:scale-105"
					/>
					<Moon
						v-else
						class="h-4 w-4 transition-transform group-hover:scale-105"
					/>
				</button>
			</div>
		</div>
	</header>
</template>
