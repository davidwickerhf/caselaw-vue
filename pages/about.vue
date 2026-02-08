<script setup lang="ts">
import { Sparkles, Target, Compass, ShieldCheck, Database, Layers, Quote, ArrowRight, BookOpen, ExternalLink } from 'lucide-vue-next'
import AppHeader from '~/components/shared/AppHeader.vue'
import AppFooter from '~/components/shared/AppFooter.vue'
import Button from '~/components/ui/button/Button.vue'

const coverage = {
  echr: 'TBD',
  rs: 'TBD'
}

const collaborators = [
  {
    name: 'BISS Institute',
    subtitle: 'BISS Institute for networked legal intelligence',
    href: 'https://www.biss-institute.com/',
    description:
      'BISS develops applied AI systems for legal research, linking citations and metadata to help practitioners move from discovery to explanation.'
  },
  {
    name: 'Maastricht University Law & Tech Lab',
    subtitle: 'Research at the intersection of law and technology',
    href: 'https://www.maastrichtuniversity.nl/research/law-and-tech-lab',
    description:
      'The Law & Tech Lab explores how digital systems transform legal reasoning, regulation, and access to justice, and collaborates on tools that make legal knowledge more usable.'
  }
]
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-background via-background to-muted/30">
    <AppHeader fixed />

    <main class="px-6 pt-20 pb-24">
      <div class="mx-auto max-w-5xl space-y-12">
        <header class="space-y-6">
          <div class="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground/80">
            <Sparkles class="h-3.5 w-3.5 text-primary/70" />
            About LegalSearch
          </div>
          <div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
            <div class="space-y-4">
              <h1 class="text-3xl font-semibold tracking-tight text-foreground">
                A unified, human-first search experience for European case law.
              </h1>
              <p class="text-sm text-muted-foreground">
                LegalSearch turns complex legal data into a fast, explainable workflow. It bridges
                natural language search and precise rule-building to make high‑signal legal research
                accessible for practitioners, students, and policy teams.
              </p>
              <p class="text-sm text-muted-foreground">
                A product of the BISS Institute, in collaboration with the Maastricht University Law & Tech Lab.
              </p>
              <div class="flex flex-wrap gap-2">
                <NuxtLink to="/">
                  <Button variant="default" size="sm" class="h-8 gap-2">
                    New search
                    <ArrowRight class="h-3.5 w-3.5" />
                  </Button>
                </NuxtLink>
                <NuxtLink to="/examples">
                  <Button variant="outline" size="sm" class="h-8 gap-2">
                    Explore examples
                    <BookOpen class="h-3.5 w-3.5" />
                  </Button>
                </NuxtLink>
              </div>
            </div>
            <div class="space-y-4">
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground/60">Guiding principle</div>
              <div class="flex items-start gap-3 rounded-xl border border-border/40 bg-background/80 p-4 text-xs text-muted-foreground">
                <Quote class="h-4 w-4 text-primary/70 mt-0.5" />
                <div>
                  <div class="text-foreground/90 font-semibold">
                    “Publicity is the very soul of justice.” — Jeremy Bentham
                  </div>
                  <div class="text-muted-foreground">
                    LegalSearch is built to make legal information more visible, searchable, and shareable.
                  </div>
                </div>
              </div>
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground/60">Supported datasets</div>
              <div class="flex items-start gap-3 rounded-xl border border-border/40 bg-background/80 p-4 text-xs text-muted-foreground">
                <Database class="h-4 w-4 text-primary/70 mt-0.5" />
                <div class="space-y-3">
                  <div>
                    <div class="text-foreground/90 font-semibold">ECHR (HUDOC)</div>
                    <div class="text-muted-foreground">
                      Judgments, decisions, and metadata with article, respondent state, and language filters.
                    </div>
                  </div>
                  <div>
                    <div class="text-foreground/90 font-semibold">Rechtspraak</div>
                    <div class="text-muted-foreground">
                      Dutch case law metadata with domains, court instances, document types, and selected laws.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-border/60" />
            <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Our mission</h2>
            <div class="h-px flex-1 bg-border/60" />
          </div>
          <div class="space-y-4 text-sm text-muted-foreground">
            <p>
              LegalSearch exists to lower the cognitive and technical barriers to legal research.
              It combines natural language input with explicit, auditable rules so every query can be understood,
              reproduced, and shared.
            </p>
            <p>
              We aim to make cross‑source legal discovery feel fast and trustworthy while preserving the
              nuance that legal analysis demands. Our focus is on transparency: users should be able to
              see exactly why a result appears, change the underlying logic, and share the same view with others.
            </p>
            <p>
              By unifying disparate sources under one consistent query language, we reduce friction between
              exploratory searching and rigorous legal verification.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              <Target class="h-3.5 w-3.5 text-primary/70" />
              Expose the logic behind every result.
            </span>
            <span class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              <Compass class="h-3.5 w-3.5 text-primary/70" />
              Unify ECHR and Rechtspraak in a single query language.
            </span>
            <span class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck class="h-3.5 w-3.5 text-primary/70" />
              Keep results shareable, stable, and explainable.
            </span>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-border/60" />
            <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">What it does</h2>
            <div class="h-px flex-1 bg-border/60" />
          </div>
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Target class="h-3.5 w-3.5 text-primary/70" />
                Natural language → rules
              </div>
              <p class="text-sm text-muted-foreground">
                The search bar parses countries, articles, years, ECLIs, and quoted keywords into
                structured rules you can verify.
              </p>
            </div>
            <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Compass class="h-3.5 w-3.5 text-primary/70" />
                Explainable query preview
              </div>
              <p class="text-sm text-muted-foreground">
                Every query has a readable preview string that can be pasted back into the search bar
                to reproduce the exact same results.
              </p>
            </div>
            <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ShieldCheck class="h-3.5 w-3.5 text-primary/70" />
                Shareable results
              </div>
              <p class="text-sm text-muted-foreground">
                Filters, sorting, and pagination state are encoded in the URL for precise, shareable results.
              </p>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-border/60" />
            <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">How it works</h2>
            <div class="h-px flex-1 bg-border/60" />
          </div>
          <ol class="grid gap-4 lg:grid-cols-3 text-sm text-muted-foreground">
            <li class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
              <div class="text-xs font-semibold text-foreground">1. Parse & normalize</div>
              Natural language is parsed into structured rules, normalized to ISO‑3 codes and validated formats.
            </li>
            <li class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
              <div class="text-xs font-semibold text-foreground">2. Execute combined search</div>
              A single combined endpoint executes dataset‑specific queries and merges the results.
            </li>
            <li class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-2">
              <div class="text-xs font-semibold text-foreground">3. Paginate with a cursor</div>
              Results stream through an opaque cursor so pagination remains consistent across sources.
            </li>
          </ol>
        </section>

        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-border/60" />
            <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Backend API</h2>
            <div class="h-px flex-1 bg-border/60" />
          </div>
          <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Database class="h-3.5 w-3.5 text-primary/70" />
              citations-api (serverless endpoints)
            </div>
            <p class="text-sm text-muted-foreground">
              The <span class="text-foreground">citations-api</span> powers Case‑Explorer with a set of serverless endpoints for
              citation networks, ECHR search, statistics, summaries, and legal link extraction. All requests use the
              <span class="text-foreground">/api</span> base path, return JSON with CORS headers, and surface errors as
              <span class="text-foreground">{ "error": "..." }</span>.
            </p>
            <div class="grid gap-3 lg:grid-cols-3 text-sm text-muted-foreground">
              <div class="rounded-lg border border-border/40 bg-background/70 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Primary data sources</div>
                <div>Rechtspraak via Elasticsearch + DynamoDB (metadata/edges) and ECHR via PostgreSQL full text.</div>
              </div>
              <div class="rounded-lg border border-border/40 bg-background/70 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Pagination rules</div>
                <div>
                  Network and ECHR search endpoints use cursor pagination with <span class="text-foreground">pageSize</span>
                  (max 1000) and <span class="text-foreground">nextCursor</span>; nodes are capped at 1000 per response.
                </div>
              </div>
              <div class="rounded-lg border border-border/40 bg-background/70 p-4 space-y-2">
                <div class="text-xs font-semibold text-foreground">Core endpoints</div>
                <div class="text-muted-foreground">
                  <span class="text-foreground font-mono">/api/network</span>, <span class="text-foreground font-mono">/api/echr</span>,
                  <span class="text-foreground font-mono">/api/echr/text</span>, <span class="text-foreground font-mono">/api/statistics</span>,
                  <span class="text-foreground font-mono">/api/community</span>, <span class="text-foreground font-mono">/api/summaries</span>,
                  <span class="text-foreground font-mono">/api/links</span>.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-border/60" />
            <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data sources</h2>
            <div class="h-px flex-1 bg-border/60" />
          </div>
          <div class="grid gap-6 lg:grid-cols-2 text-sm text-muted-foreground">
            <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-3">
              <div class="text-xs font-semibold text-foreground">ECHR (HUDOC)</div>
              <p>
                European Court of Human Rights judgments, decisions, and related metadata. Supports articles,
                respondent states, application numbers, languages, and judgment/decision dates.
              </p>
              <div class="text-[11px] uppercase tracking-wider text-muted-foreground/70">Coverage through</div>
              <div class="text-sm text-foreground">{{ coverage.echr }}</div>
            </div>
            <div class="rounded-xl border border-border/40 bg-background/80 p-4 space-y-3">
              <div class="text-xs font-semibold text-foreground">Rechtspraak</div>
              <p>
                Dutch case law metadata indexed in Elasticsearch. Supports legal domains, court instances,
                document types, and selected laws.
              </p>
              <div class="text-[11px] uppercase tracking-wider text-muted-foreground/70">Coverage through</div>
              <div class="text-sm text-foreground">{{ coverage.rs }}</div>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-border/60" />
            <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Collaborators</h2>
            <div class="h-px flex-1 bg-border/60" />
          </div>
          <div class="grid gap-6 lg:grid-cols-2">
            <a
              v-for="collab in collaborators"
              :key="collab.name"
              :href="collab.href"
              target="_blank"
              rel="noopener"
              class="group rounded-xl border border-border/40 bg-background/80 p-5 space-y-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-background/90"
            >
              <div class="flex items-center gap-3">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-border/50 bg-background/70 text-foreground">
                  <svg v-if="collab.name.includes('BISS')" viewBox="0 0 64 64" class="h-8 w-8">
                    <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="3" />
                    <text x="32" y="38" text-anchor="middle" font-size="20" font-family="ui-sans-serif" fill="currentColor">BISS</text>
                  </svg>
                  <svg v-else viewBox="0 0 64 64" class="h-8 w-8">
                    <rect x="6" y="6" width="52" height="52" rx="12" fill="none" stroke="currentColor" stroke-width="3" />
                    <text x="32" y="38" text-anchor="middle" font-size="18" font-family="ui-sans-serif" fill="currentColor">MU</text>
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-foreground group-hover:text-primary/90 transition-colors">
                    {{ collab.name }}
                  </div>
                  <div class="text-xs text-muted-foreground">{{ collab.subtitle }}</div>
                </div>
                <ExternalLink class="ml-auto h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary/80 transition-colors" />
              </div>
              <p class="text-sm text-muted-foreground">
                {{ collab.description }}
              </p>
            </a>
          </div>
        </section>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
