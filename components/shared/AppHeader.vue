<script setup lang="ts">
import { computed } from "vue";
import { Scale, Moon, Sun, Search, Library } from "lucide-vue-next";
import Tooltip from "~/components/ui/tooltip/Tooltip.vue";
import { useLibrary } from "~/composables/useLibrary";

const props = defineProps<{
	fixed?: boolean;
}>();

const config = useRuntimeConfig();
const apiBaseUrl = computed(() => config.public.apiBaseUrl as string);
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === "dark");
const { libraryOpen, toggleLibrary } = useLibrary();

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
		<div class="mx-auto grid h-12 grid-cols-[auto_1fr_auto] items-center px-0">
			<!-- Left: Library toggle + Logo -->
			<div class="flex items-center h-full">
				<Tooltip :text="libraryOpen ? 'Close library' : 'Open library'" side="bottom">
					<button
						:class="[
							'group flex h-full items-center justify-center w-12 transition-all duration-200 ease-out hover:bg-muted/40 active:scale-[0.98]',
							libraryOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
						]"
						@click="toggleLibrary"
						aria-label="Toggle library"
					>
						<Library class="h-4 w-4 transition-transform group-hover:scale-105" />
					</button>
				</Tooltip>
				<div class="w-px h-full bg-border" />
				<NuxtLink
					to="/"
					class="flex items-center gap-2 font-semibold tracking-tight text-foreground px-4"
				>
					<Scale class="h-4 w-4 text-primary" />
					<span class="text-sm">LegalSearch</span>
				</NuxtLink>
			</div>

			<!-- Center: Nav links -->
			<nav class="flex items-center justify-center gap-7 text-sm text-muted-foreground">
				<NuxtLink to="/" class="hover:text-foreground transition-colors">Search</NuxtLink>
				<NuxtLink to="/examples" class="hover:text-foreground transition-colors">Examples</NuxtLink>
				<NuxtLink to="/docs" class="hover:text-foreground transition-colors">Docs</NuxtLink>
				<NuxtLink to="/about" class="hover:text-foreground transition-colors">About</NuxtLink>
				<a :href="apiBaseUrl" class="hover:text-foreground transition-colors">Citations API</a>
			</nav>

			<!-- Right: Actions -->
			<div class="flex flex-row h-full">
				<div class="w-px h-full bg-border" />
				<NuxtLink
					to="/"
					target="_blank"
					rel="noopener"
					class="group flex h-full items-center justify-center gap-2 whitespace-nowrap px-4 text-sm text-muted-foreground transition-all duration-200 ease-out hover:text-foreground hover:bg-muted/40 active:scale-[0.98]"
				>
					<Search class="h-4 w-4 transition-transform group-hover:scale-105" />
					New Tab
				</NuxtLink>
				<div class="w-px h-full bg-border" />
				<button
					class="group flex h-full w-12 shrink-0 items-center justify-center px-0 text-sm font-semibold text-muted-foreground transition-all duration-200 ease-out hover:text-foreground hover:bg-muted/40 active:scale-[0.98]"
					@click="toggleMode"
				>
					<Sun v-if="isDark" class="h-4 w-4 transition-transform group-hover:scale-105" />
					<Moon v-else class="h-4 w-4 transition-transform group-hover:scale-105" />
				</button>
			</div>
		</div>
	</header>
</template>
