import { recognizeKeywords } from './recognizers/keyword-recognizer';
import { recognizeEcli } from './recognizers/ecli-recognizer';
import { recognizeArticles } from './recognizers/article-recognizer';
import { recognizeApplicationNumbers } from './recognizers/application-recognizer';
import { recognizeStates } from './recognizers/state-recognizer';
import { recognizeSources } from './recognizers/source-recognizer';
import { recognizeExplicitFields } from './recognizers/explicit-field-recognizer';
import { recognizeDegrees } from './recognizers/degree-recognizer';
import { recognizeMetadata } from './recognizers/metadata-recognizer';
import { recognizeDates } from './recognizers/date-recognizer';
import type { ParseResult, ParsedToken, ParseSuggestion } from '~/lib/types';

/**
 * Mask consumed spans in the input by replacing them with spaces.
 * All spans reference positions in the original input.
 */
function maskSpans(input: string, spans: [number, number][]): string {
    const chars = input.split('');
    for (const [start, end] of spans) {
        for (let i = start; i < end && i < chars.length; i++) {
            chars[i] = ' ';
        }
    }
    return chars.join('');
}

/**
 * Remove consumed spans from input and clean up whitespace.
 */
function removeSpans(input: string, spans: [number, number][]): string {
    const sorted = [...spans].sort((a, b) => b[0] - a[0]);
    let result = input;
    for (const [start, end] of sorted) {
        result = result.slice(0, start) + result.slice(end);
    }
    return result.replace(/\s+/g, ' ').trim();
}

/**
 * Parse search input text and extract structured tokens + suggestions.
 *
 * Runs recognizers in priority order:
 * 1. Explicit field patterns (title, language, explicit dates, etc.)
 * 2. Graph degrees (degree source/target, depth)
 * 3. Keywords (quoted phrases)
 * 4. ECLI
 * 5. Articles (most complex, highest priority)
 * 6. Application numbers
 * 7. States (multi-word country names)
 * 8. Sources (ECHR/Rechtspraak)
 * 9. Metadata (doc types, importance, instances, domains)
 * 10. Dates (years, ranges)
 *
 * Each recognizer receives a masked version of the input where
 * previously consumed spans are replaced with spaces.
 */
export function parseSearchInput(input: string): ParseResult {
    const allTokens: ParsedToken[] = [];
    const allSuggestions: ParseSuggestion[] = [];
    const allConsumed: [number, number][] = [];

    // 1. Explicit field patterns (title, language, explicit dates, etc.)
    const explicit = recognizeExplicitFields(input);
    allTokens.push(...explicit.tokens);
    allSuggestions.push(...explicit.suggestions);
    allConsumed.push(...explicit.consumed);

    // 2. Graph degrees (source/target/depth)
    let masked = maskSpans(input, allConsumed);
    const degrees = recognizeDegrees(masked);
    allTokens.push(...degrees.tokens);
    allSuggestions.push(...degrees.suggestions);
    allConsumed.push(...degrees.consumed);

    // 3. Keywords (quoted phrases)
    masked = maskSpans(input, allConsumed);
    const keywords = recognizeKeywords(masked);
    allTokens.push(...keywords.tokens);
    allSuggestions.push(...keywords.suggestions);
    allConsumed.push(...keywords.consumed);

    // 4. ECLI
    masked = maskSpans(input, allConsumed);
    const eclis = recognizeEcli(masked);
    allTokens.push(...eclis.tokens);
    allSuggestions.push(...eclis.suggestions);
    allConsumed.push(...eclis.consumed);

    // 5. Articles
    masked = maskSpans(input, allConsumed);
    const articles = recognizeArticles(masked);
    allTokens.push(...articles.tokens);
    allSuggestions.push(...articles.suggestions);
    allConsumed.push(...articles.consumed);

    // 6. Application numbers
    masked = maskSpans(input, allConsumed);
    const apps = recognizeApplicationNumbers(masked);
    allTokens.push(...apps.tokens);
    allSuggestions.push(...apps.suggestions);
    allConsumed.push(...apps.consumed);

    // 7. States (on masked input)
    masked = maskSpans(input, allConsumed);
    const states = recognizeStates(masked);
    allTokens.push(...states.tokens);
    allSuggestions.push(...states.suggestions);
    allConsumed.push(...states.consumed);

    // 8. Sources
    masked = maskSpans(input, allConsumed);
    const sources = recognizeSources(masked);
    allTokens.push(...sources.tokens);
    allSuggestions.push(...sources.suggestions);
    allConsumed.push(...sources.consumed);

    // 9. Metadata
    masked = maskSpans(input, allConsumed);
    const metadata = recognizeMetadata(masked);
    allTokens.push(...metadata.tokens);
    allSuggestions.push(...metadata.suggestions);
    allConsumed.push(...metadata.consumed);

    // 10. Dates
    masked = maskSpans(input, allConsumed);
    const dates = recognizeDates(masked);
    allTokens.push(...dates.tokens);
    allSuggestions.push(...dates.suggestions);
    allConsumed.push(...dates.consumed);

    // Remaining text: keep original input (no auto-consumption)
    const remainingText = input;

    allSuggestions.sort((a, b) =>
        a.triggerStart === b.triggerStart
            ? a.triggerEnd - b.triggerEnd
            : a.triggerStart - b.triggerStart
    );

    return {
        tokens: allTokens,
        suggestions: allSuggestions,
        remainingText,
    };
}
