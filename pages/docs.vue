<script setup lang="ts">
import { BookOpen, Sparkles, ArrowRight, Layers, Quote, Calendar, Scale, CheckCircle2, AlertTriangle, Globe, SlidersHorizontal, ArrowUpDown, Rows, Link2, Lightbulb } from 'lucide-vue-next'
import AppHeader from '~/components/shared/AppHeader.vue'
import AppFooter from '~/components/shared/AppFooter.vue'
import Button from '~/components/ui/button/Button.vue'
import QueryBuilderStandalone from '~/components/search/QueryBuilderStandalone.vue'
import QueryPreview from '~/components/search/QueryPreview.vue'
import { parseNaturalLanguageToQueryBuilderGroup } from '~/lib/parser/nl-query-parser'
import { defaultScopeForField } from '~/lib/utils/query-builder-config'
import type { QueryBuilderGroup } from '~/lib/types'

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function makeRule(field: string, value: string, operator: string = 'contains', scope?: QueryBuilderGroup['rules'][number]['sourceScope']) {
  return {
    id: genId(),
    field,
    operator,
    value,
    sourceScope: scope ?? defaultScopeForField(field)
  }
}

function makeGroup(operator: 'AND' | 'OR' | 'NOT', rules: ReturnType<typeof makeRule>[], groups: QueryBuilderGroup[] = []): QueryBuilderGroup {
  return {
    id: genId(),
    operator,
    rules,
    groups
  }
}

const tutorialSearch1 = 'Cases in Germany in 2010 with Article 6 violated'
const tutorialSearch2 = 'ECHR "fair trial" 2018'
const tutorialSearch3 = 'Rechtspraak "tax law" between 2014 and 2016'
const tutorialSearch4 = 'date start 2020-02-01 date end 2020-03-15'
const tutorialSearch5 = 'language ENG judgment date on 2020-05-01'

const tutorialGroup1 = parseNaturalLanguageToQueryBuilderGroup(tutorialSearch1)
const tutorialGroup2 = parseNaturalLanguageToQueryBuilderGroup(tutorialSearch2)
const tutorialGroup3 = parseNaturalLanguageToQueryBuilderGroup(tutorialSearch3)
const tutorialGroup4 = parseNaturalLanguageToQueryBuilderGroup(tutorialSearch4)
const tutorialGroup5 = parseNaturalLanguageToQueryBuilderGroup(tutorialSearch5)

const builderBasicGroup = makeGroup('AND', [
  makeRule('respondent_state', 'Germany', 'equals', 'ECHR'),
  makeRule('article_violated', '6', 'equals', 'ECHR'),
  makeRule('year', '2010', 'equals', 'ANY')
])

const builderGroupExample = makeGroup('OR', [], [
  makeGroup('AND', [
    makeRule('article_violated', '5', 'equals', 'ECHR'),
    makeRule('year', '2018', 'after', 'ANY')
  ]),
  makeGroup('AND', [
    makeRule('domain', 'Bestuursrecht', 'equals', 'RS'),
    makeRule('year', '2018', 'after', 'ANY')
  ])
])

const builderNotGroup = makeGroup('AND', [
  makeRule('year', '2019', 'equals', 'ANY')
], [
  makeGroup('NOT', [
    makeRule('domain', 'Personen- en familierecht', 'equals', 'RS')
  ])
])
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-background via-background to-muted/30">
    <AppHeader fixed />

    <main class="px-6 pt-20 pb-24">
      <div class="mx-auto max-w-6xl">
        <div class="flex gap-10">
          <aside class="hidden lg:block w-56 shrink-0">
            <div class="sticky top-24 space-y-3">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Outline
              </div>
              <div class="space-y-2 text-xs text-muted-foreground">
                <a href="#overview" class="block hover:text-foreground transition-colors">Overview</a>
                <div class="h-px bg-border/60" />
                <a href="#tutorial" class="block hover:text-foreground transition-colors">Tutorial Path</a>
                <a href="#search-bar" class="block hover:text-foreground transition-colors">Search Bar Basics</a>
                <a href="#keywords" class="block hover:text-foreground transition-colors">Quoted Keywords</a>
                <a href="#dates" class="block hover:text-foreground transition-colors">Dates & Ranges</a>
                <a href="#datasource" class="block hover:text-foreground transition-colors">Data Sources</a>
                <a href="#query-builder" class="block hover:text-foreground transition-colors">Query Builder Basics</a>
                <a href="#builder-anatomy" class="block hover:text-foreground transition-colors">Builder Anatomy</a>
                <a href="#groups" class="block hover:text-foreground transition-colors">Groups & Logic</a>
                <a href="#mixed" class="block hover:text-foreground transition-colors">Mixed-Dataset Queries</a>
                <a href="#fields" class="block hover:text-foreground transition-colors">Fields & Operators</a>
                <a href="#validation" class="block hover:text-foreground transition-colors">Validation Rules</a>
                <a href="#editing" class="block hover:text-foreground transition-colors">Editing the Summary</a>
                <a href="#filters" class="block hover:text-foreground transition-colors">Filters, Sorting, Pagination</a>
                <a href="#errors" class="block hover:text-foreground transition-colors">Errors & Fixes</a>
                <a href="#rules" class="block hover:text-foreground transition-colors">Rules & Limits</a>
                <a href="#sharing" class="block hover:text-foreground transition-colors">Sharing & URLs</a>
              </div>
            </div>
          </aside>

          <div class="flex-1 space-y-12">
            <header id="overview" class="space-y-6">
              <div class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
                <div class="space-y-4">
                  <div class="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground/80">
                    <BookOpen class="h-3.5 w-3.5 text-primary/70" />
                    Docs
                  </div>
                  <h1 class="text-3xl font-semibold tracking-tight text-foreground">
                    Learn the query language, step by step.
                  </h1>
                  <p class="text-sm text-muted-foreground max-w-2xl">
                    This guide explains how to use the natural language search bar and the query builder together.
                    Start simple, add precision with rules, and build complex queries using groups, exact dates, and dataset‑specific fields.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <NuxtLink to="/examples">
                      <Button variant="default" size="sm" class="h-8 gap-2">
                        <Sparkles class="h-3.5 w-3.5" />
                        Explore examples
                      </Button>
                    </NuxtLink>
                    <NuxtLink to="/">
                      <Button variant="outline" size="sm" class="h-8 gap-2">
                        New search
                        <ArrowRight class="h-3.5 w-3.5" />
                      </Button>
                    </NuxtLink>
                  </div>
                </div>
                <div class="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm space-y-4">
                  <div class="text-[10px] uppercase tracking-wider text-muted-foreground/60">Quick start</div>
                  <ol class="space-y-3 text-xs text-muted-foreground">
                    <li class="flex gap-3">
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">1</span>
                      Type a natural query in the search bar.
                    </li>
                    <li class="flex gap-3">
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">2</span>
                      Review the parsed parameters.
                    </li>
                    <li class="flex gap-3">
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">3</span>
                      Refine with the query builder or edit the summary bar.
                    </li>
                  </ol>
                  <div class="rounded-xl border border-border/40 bg-background/80 p-3 text-xs text-muted-foreground">
                    <div class="font-semibold text-foreground/80 mb-1">Key rule</div>
                    Keywords only parse when wrapped in quotes, for example: <span class="text-foreground">"right to life"</span>.
                  </div>
                </div>
              </div>
            </header>

            <section id="tutorial" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tutorial path</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Lightbulb class="h-3.5 w-3.5 text-primary/70" />
                Start with natural language, then verify the parsed rules.
              </div>
              <div class="space-y-4">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Step 1 — Start simple</div>
                  <div class="text-xs text-muted-foreground">
                    Use a single sentence with a country + year + article. The parser will extract structured rules.
                  </div>
                  <code class="text-xs text-foreground/80 font-mono">{{ tutorialSearch1 }}</code>
                  <QueryPreview :group="tutorialGroup1" class="mt-3" />
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Step 2 — Add a keyword</div>
                  <div class="text-xs text-muted-foreground">
                    Quote the phrase to force full‑text search. Unquoted words are not treated as keywords.
                  </div>
                  <code class="text-xs text-foreground/80 font-mono">{{ tutorialSearch2 }}</code>
                  <QueryPreview :group="tutorialGroup2" class="mt-3" />
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Step 3 — Add a date range</div>
                  <div class="text-xs text-muted-foreground">
                    Use “between” to generate two year rules (after/before). The preview shows the actual rules.
                  </div>
                  <code class="text-xs text-foreground/80 font-mono">{{ tutorialSearch3 }}</code>
                  <QueryPreview :group="tutorialGroup3" class="mt-3" />
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Step 4 — Use exact dates and languages</div>
                  <div class="text-xs text-muted-foreground">
                    Use explicit date start/end or ECHR judgment/decision dates when you need exact filters.
                  </div>
                  <code class="text-xs text-foreground/80 font-mono">{{ tutorialSearch4 }}</code>
                  <QueryPreview :group="tutorialGroup4" class="mt-3" />
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Step 5 — Move to the builder</div>
                  <div class="text-xs text-muted-foreground">
                    Open the query builder to refine operators, change scopes, or add groups.
                  </div>
                  <QueryBuilderStandalone :group="builderBasicGroup" />
                  <QueryPreview :group="builderBasicGroup" class="mt-3" />
                </div>
              </div>
            </section>

            <section id="search-bar" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Search bar basics</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <p class="text-sm text-muted-foreground">
                The search bar recognizes fields like countries, articles, years, ECLIs, and dataset hints.
                It converts what it recognizes into structured rules, and leaves the rest untouched.
                You can also use explicit field phrases like <span class="text-foreground">title "privacy"</span> or <span class="text-foreground">language ENG</span>.
              </p>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Scale class="h-3.5 w-3.5 text-primary/70" />
                    Example query
                  </div>
                  <code class="text-xs text-foreground/80 font-mono">
                    Cases in Germany in 2010 with Article 6 violated
                  </code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">What gets parsed</div>
                  <div class="text-xs text-muted-foreground">Respondent state, year, and article violated.</div>
                </div>
              </div>
              <QueryPreview :group="tutorialGroup1" />
            </section>

            <section id="keywords" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quoted keywords</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Quote class="h-3.5 w-3.5 text-primary/70" />
                Keywords only parse inside quotation marks
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Parses</div>
                  <code class="text-xs text-foreground/80 font-mono">ECHR "fair trial" 2016</code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Does not parse as keyword</div>
                  <code class="text-xs text-foreground/80 font-mono">ECHR fair trial 2016</code>
                </div>
              </div>
              <p class="text-xs text-muted-foreground">
                Quoted keywords always map to full-text search and are displayed with quotes in previews.
              </p>
              <QueryPreview :group="tutorialGroup2" />
            </section>

            <section id="dates" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dates & ranges</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Calendar class="h-3.5 w-3.5 text-primary/70" />
                Year detection
              </div>
              <div class="grid gap-4 lg:grid-cols-3">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Single year</div>
                  <code class="text-xs text-foreground/80 font-mono">2019</code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">After / before</div>
                  <code class="text-xs text-foreground/80 font-mono">after 2015</code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Between</div>
                  <code class="text-xs text-foreground/80 font-mono">between 2014 and 2016</code>
                </div>
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Calendar class="h-3.5 w-3.5 text-primary/70" />
                Exact dates (YYYY‑MM‑DD)
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Explicit range</div>
                  <code class="text-xs text-foreground/80 font-mono">date start 2020-02-01 date end 2020-03-15</code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Judgment / decision</div>
                  <code class="text-xs text-foreground/80 font-mono">judgment date on 2020-05-01</code>
                </div>
              </div>
              <p class="text-xs text-muted-foreground">
                Years must be valid four-digit years and cannot be in the future. Exact dates must use YYYY‑MM‑DD and also cannot be future dates.
              </p>
              <QueryPreview :group="tutorialGroup3" />
              <QueryPreview :group="tutorialGroup4" class="mt-3" />
              <QueryPreview :group="tutorialGroup5" class="mt-3" />
            </section>

            <section id="datasource" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data sources</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <p class="text-sm text-muted-foreground">
                Some fields exist only in one dataset. The parser uses the dataset to decide where a rule can live.
              </p>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">ECHR‑only examples</div>
                  <div class="text-xs text-muted-foreground">
                    Respondent State, Article Violated, Application Number, Language, Judgment/Decision Dates.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Rechtspraak‑only examples</div>
                  <div class="text-xs text-muted-foreground">
                    Legal Domain, Court Instance, Articles, Selected Laws.
                  </div>
                </div>
              </div>
            </section>

            <section id="query-builder" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Query builder basics</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <p class="text-sm text-muted-foreground">
                Use the query builder to fine-tune rules, operators, and scopes. Each rule includes:
              </p>
              <div class="grid gap-4 lg:grid-cols-3">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-1">
                  <div class="text-xs font-semibold text-foreground">Scope</div>
                  <div class="text-xs text-muted-foreground">Any, ECHR, or Rechtspraak.</div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-1">
                  <div class="text-xs font-semibold text-foreground">Field</div>
                  <div class="text-xs text-muted-foreground">Article, year, domain, etc.</div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-1">
                  <div class="text-xs font-semibold text-foreground">Operator + value</div>
                  <div class="text-xs text-muted-foreground">Equals, contains, before, after.</div>
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Good to know</div>
                <div class="text-xs text-muted-foreground">
                  The builder and search bar share the same parsing rules. Editing either one updates the other.
                </div>
              </div>
              <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <QueryBuilderStandalone :group="builderBasicGroup" />
                <QueryPreview :group="builderBasicGroup" class="self-start" />
              </div>
            </section>

            <section id="builder-anatomy" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Builder anatomy</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <p class="text-sm text-muted-foreground">
                Each row in the builder is a rule. Rules belong to the root group or to one group.
                Groups are a single level deep and can use AND, OR, or NOT.
              </p>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Rule parts</div>
                  <code class="text-xs text-foreground/80 font-mono">
                    Scope + Field + Operator + Value
                  </code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Group parts</div>
                  <code class="text-xs text-foreground/80 font-mono">
                    Operator + rule list
                  </code>
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Query preview blocks</div>
                <div class="text-xs text-muted-foreground">
                  The preview block is a read‑only summary of the current query builder state. It shows the exact
                  scopes, fields, operators, and values that will be sent to the API, including quotes for full‑text rules.
                  Paste the preview back into the search bar to reproduce the same query.
                </div>
              </div>
              <QueryPreview :group="builderBasicGroup" />
            </section>

            <section id="groups" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Groups & logic</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Layers class="h-3.5 w-3.5 text-primary/70" />
                One level of grouping
              </div>
              <p class="text-sm text-muted-foreground">
                Groups let you combine rules with OR or NOT. Nested groups are not supported.
              </p>
              <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <QueryBuilderStandalone :group="builderGroupExample" />
                <QueryPreview :group="builderGroupExample" class="self-start" />
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">NOT group example</div>
                <code class="text-xs text-foreground/80 font-mono">
                  year equals 2019 AND NOT (Rechtspraak domain Personen- en familierecht)
                </code>
                <QueryPreview :group="builderNotGroup" class="mt-3" />
              </div>
            </section>

            <section id="mixed" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mixed-dataset queries</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <p class="text-sm text-muted-foreground">
                When mixing dataset‑specific rules, group them so each dataset gets a valid branch.
                Keep common filters (like year) outside the OR group.
              </p>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Recommended pattern</div>
                  <code class="text-xs text-foreground/80 font-mono">
                    (ECHR respondent state Germany) OR (Rechtspraak instance Raad van State) AND year equals 2016
                  </code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Avoid</div>
                  <code class="text-xs text-foreground/80 font-mono">
                    ECHR respondent state Germany AND Rechtspraak instance Raad van State
                  </code>
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Why this matters</div>
                <div class="text-xs text-muted-foreground">
                  AND requires both datasets to satisfy all rules. Use OR branches so each dataset gets a valid rule set.
                </div>
              </div>
              <QueryPreview :group="builderGroupExample" />
            </section>

            <section id="fields" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fields & operators</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-3">
                <div class="text-xs font-semibold text-foreground">Common fields (Any)</div>
                <div class="grid gap-2 lg:grid-cols-3 text-xs text-muted-foreground">
                  <div>Full Text: contains, does not contain</div>
                  <div>Title: contains, equals, does not contain</div>
                  <div>ECLI: contains, equals, does not contain</div>
                  <div>Keywords: contains, does not contain</div>
                  <div>Year: equals, after, before</div>
                  <div>Date Start: equals, after</div>
                  <div>Date End: equals, before</div>
                  <div>Data Source: equals, contains, not equals</div>
                </div>
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-3">
                  <div class="text-xs font-semibold text-foreground">ECHR-only</div>
                  <div class="text-xs text-muted-foreground space-y-1">
                    <div>Article Violated / Applied / Non‑Violated: equals, contains, not contains</div>
                    <div>Respondent State: equals, not equals</div>
                    <div>Application Number: equals, contains</div>
                    <div>Document Type: equals</div>
                    <div>Importance: equals, at most</div>
                    <div>Language: equals, not equals (ISO‑3)</div>
                    <div>Judgment Dates: equals, after, before (YYYY‑MM‑DD)</div>
                    <div>Decision Dates: equals, after, before (YYYY‑MM‑DD)</div>
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-3">
                  <div class="text-xs font-semibold text-foreground">Rechtspraak-only</div>
                  <div class="text-xs text-muted-foreground space-y-1">
                    <div>Legal Domain: equals (Dutch values)</div>
                    <div>Court Instance: equals</div>
                    <div>Document Type: equals</div>
                    <div>Articles: contains, equals, not contains</div>
                    <div>Selected Laws: equals, contains (BWBX…)</div>
                  </div>
                </div>
              </div>
            </section>

            <section id="validation" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Validation rules</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <CheckCircle2 class="h-3.5 w-3.5 text-primary/70" />
                    Required formats
                  </div>
                  <div class="text-xs text-muted-foreground">
                    Years must be four digits and not in the future. Exact dates must be YYYY‑MM‑DD.
                    Importance must be 1–4. Document types must match the allowed codes.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Globe class="h-3.5 w-3.5 text-primary/70" />
                    Normalization
                  </div>
                  <div class="text-xs text-muted-foreground">
                    Respondent states are normalized to ISO‑3 codes. Languages must be ISO‑3 codes.
                    Rechtspraak legal domains are stored in Dutch and mapped from English when possible.
                  </div>
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Identifiers</div>
                <div class="text-xs text-muted-foreground">
                  Selected Laws must look like <span class="text-foreground">BWBX1234|56</span>. Application numbers must look like <span class="text-foreground">12345/67</span>.
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <AlertTriangle class="h-3.5 w-3.5 text-primary/70" />
                  Scope constraints
                </div>
                <div class="text-xs text-muted-foreground">
                  AND groups cannot mix incompatible dataset scopes. If a rule only exists in one dataset, it must be scoped to that dataset or grouped with OR.
                </div>
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Valid</div>
                  <code class="text-xs text-foreground/80 font-mono">ECHR respondent state Germany 2019</code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Invalid</div>
                  <code class="text-xs text-foreground/80 font-mono">year 3024, domain "Administrative law"</code>
                </div>
              </div>
            </section>

            <section id="editing" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Editing the summary</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <p class="text-sm text-muted-foreground">
                On the results page, the summary row is editable. Only scoped values are editable.
                Changes apply on blur or Enter.
              </p>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Validation feedback</div>
                  <div class="text-xs text-muted-foreground">
                    Invalid edits highlight in red and reset on blur with a toast explaining why.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Editable scopes</div>
                  <div class="text-xs text-muted-foreground">
                    You can change the dataset label if the rule is allowed in that dataset.
                  </div>
                </div>
              </div>
            </section>

            <section id="filters" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Filters, sorting, pagination</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="grid gap-4 lg:grid-cols-3">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <SlidersHorizontal class="h-3.5 w-3.5 text-primary/70" />
                    Filters
                  </div>
                  <div class="text-xs text-muted-foreground">
                    Applied on top of the query builder. Filters do not rewrite the base query.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <ArrowUpDown class="h-3.5 w-3.5 text-primary/70" />
                    Sorting
                  </div>
                  <div class="text-xs text-muted-foreground">
                    Sort changes reset cursor pagination to keep ordering consistent.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Rows class="h-3.5 w-3.5 text-primary/70" />
                    Pagination
                  </div>
                  <div class="text-xs text-muted-foreground">
                    Uses an opaque cursor. Changing filters or sort restarts pagination.
                  </div>
                </div>
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Lifecycle</div>
                  <div class="text-xs text-muted-foreground">
                    Query → fetch results → enable sort and selection after the full set is fetched.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Selection scope</div>
                  <div class="text-xs text-muted-foreground">
                    “Select all” applies across pages once the full result set is available.
                  </div>
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Link2 class="h-3.5 w-3.5 text-primary/70" />
                  Result state in the URL
                </div>
                <div class="text-xs text-muted-foreground">
                  Filters, sorting, and pagination context are encoded in the URL so you can share the exact view.
                </div>
              </div>
            </section>

            <section id="errors" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Errors & fixes</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">No applicable rules after scope filtering</div>
                <div class="text-xs text-muted-foreground">
                  Means rules were mixed across datasets in an AND group. Fix by creating OR groups per dataset.
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Invalid value</div>
                <div class="text-xs text-muted-foreground">
                  Input failed validation (year, domain, or respondent state). Edit and retry.
                </div>
              </div>
            </section>

            <section id="rules" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rules & limits</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Structure</div>
                  <div class="text-xs text-muted-foreground">
                    Only one group level is supported. Nested groups are rejected.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Scope rules</div>
                  <div class="text-xs text-muted-foreground">
                    AND groups cannot mix incompatible dataset‑specific scopes.
                  </div>
                </div>
              </div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Keywords</div>
                  <div class="text-xs text-muted-foreground">
                    Only quoted phrases become full‑text rules. Unquoted words are ignored as keywords.
                  </div>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Normalization</div>
                  <div class="text-xs text-muted-foreground">
                    Country names normalize to ISO‑3; Rechtspraak domains normalize to Dutch values.
                  </div>
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Exact date format</div>
                <div class="text-xs text-muted-foreground">
                  Exact date filters (Date Start/End, Judgment/Decision dates) must be YYYY‑MM‑DD and not in the future.
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Pagination rule</div>
                <div class="text-xs text-muted-foreground">
                  Changing query, filters, or sort invalidates the cursor and restarts pagination.
                </div>
              </div>
            </section>

            <section id="sharing" class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sharing & URLs</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>
              <p class="text-sm text-muted-foreground">
                The results URL encodes the query builder, filters, sort order, and pagination context.
                Sharing that URL reproduces the same result view for your colleague.
              </p>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">Example URL</div>
                  <code class="text-[11px] text-foreground/80 font-mono break-all">
                    /results?qb=%7B%22op%22%3A%22AND%22%2C%22rules%22%3A...%7D&searchString=Cases+in+Germany+2010
                  </code>
                </div>
                <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                  <div class="text-xs font-semibold text-foreground">With filters + pagination</div>
                  <code class="text-[11px] text-foreground/80 font-mono break-all">
                    /results?qb=%7B...%7D&searchString=ECHR+%22fair+trial%22&sortBy=date&sortDirection=desc&cursor=opaque-token
                  </code>
                </div>
              </div>
              <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Tip</div>
                <div class="text-xs text-muted-foreground">
                  When you change filters or sort order, the cursor resets to keep pagination consistent.
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
