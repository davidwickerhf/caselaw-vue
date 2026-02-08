import type { ParsedToken } from '~/lib/types';

export function smartSearchChipClasses(
	type: ParsedToken['type'],
	variant: 'default' | 'summary' = 'default'
): string {
	const ring = variant === 'summary' ? 'border' : 'ring-1';
	switch (type) {
		case 'article_violated':
		case 'article_applied':
		case 'article_non_violated':
			return `${ring} bg-blue-50/70 text-blue-700 ${variant === 'summary' ? 'border-blue-200/60' : 'ring-blue-200/60'} dark:bg-blue-950/35 dark:text-blue-200 ${variant === 'summary' ? 'dark:border-blue-800/50' : 'dark:ring-blue-800/50'}`;
		case 'respondent_state':
			return `${ring} bg-emerald-50/70 text-emerald-700 ${variant === 'summary' ? 'border-emerald-200/60' : 'ring-emerald-200/60'} dark:bg-emerald-950/35 dark:text-emerald-200 ${variant === 'summary' ? 'dark:border-emerald-800/50' : 'dark:ring-emerald-800/50'}`;
		case 'year':
		case 'date_start':
		case 'date_end':
			return `${ring} bg-amber-50/70 text-amber-700 ${variant === 'summary' ? 'border-amber-200/60' : 'ring-amber-200/60'} dark:bg-amber-950/35 dark:text-amber-200 ${variant === 'summary' ? 'dark:border-amber-800/50' : 'dark:ring-amber-800/50'}`;
		case 'document_type':
			return `${ring} bg-violet-50/70 text-violet-700 ${variant === 'summary' ? 'border-violet-200/60' : 'ring-violet-200/60'} dark:bg-violet-950/35 dark:text-violet-200 ${variant === 'summary' ? 'dark:border-violet-800/50' : 'dark:ring-violet-800/50'}`;
		case 'importance':
			return `${ring} bg-orange-50/70 text-orange-700 ${variant === 'summary' ? 'border-orange-200/60' : 'ring-orange-200/60'} dark:bg-orange-950/35 dark:text-orange-200 ${variant === 'summary' ? 'dark:border-orange-800/50' : 'dark:ring-orange-800/50'}`;
		case 'source':
			return `${ring} bg-indigo-50/70 text-indigo-700 ${variant === 'summary' ? 'border-indigo-200/60' : 'ring-indigo-200/60'} dark:bg-indigo-950/35 dark:text-indigo-200 ${variant === 'summary' ? 'dark:border-indigo-800/50' : 'dark:ring-indigo-800/50'}`;
		case 'instance':
		case 'domain':
			return `${ring} bg-teal-50/70 text-teal-700 ${variant === 'summary' ? 'border-teal-200/60' : 'ring-teal-200/60'} dark:bg-teal-950/35 dark:text-teal-200 ${variant === 'summary' ? 'dark:border-teal-800/50' : 'dark:ring-teal-800/50'}`;
		case 'keyword':
			return `${ring} bg-rose-50/70 text-rose-700 ${variant === 'summary' ? 'border-rose-200/60' : 'ring-rose-200/60'} dark:bg-rose-950/35 dark:text-rose-200 ${variant === 'summary' ? 'dark:border-rose-800/50' : 'dark:ring-rose-800/50'}`;
		case 'degree_source':
		case 'degree_target':
		case 'degree_depth':
		case 'subgraph':
			return `${ring} bg-slate-50/70 text-slate-700 ${variant === 'summary' ? 'border-slate-200/60' : 'ring-slate-200/60'} dark:bg-slate-950/35 dark:text-slate-200 ${variant === 'summary' ? 'dark:border-slate-800/50' : 'dark:ring-slate-800/50'}`;
		default:
			return `${ring} bg-muted/60 text-foreground ${variant === 'summary' ? 'border-border/60' : 'ring-border/60'} dark:bg-muted/50 ${variant === 'summary' ? 'dark:border-border/80' : 'dark:ring-border/80'}`;
	}
}
