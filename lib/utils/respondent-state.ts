import { RESPONDENT_STATE_ALIASES, RESPONDENT_STATE_CODES } from '~/lib/utils/constants';

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
	Object.entries(RESPONDENT_STATE_CODES).map(([name, code]) => [name.toLowerCase(), code])
);

const CODE_TO_NAME: Record<string, string> = Object.fromEntries(
	Object.entries(RESPONDENT_STATE_CODES).map(([name, code]) => [code, name])
);

const ALIAS_TO_CODE: Record<string, string> = Object.fromEntries(
	Object.entries(RESPONDENT_STATE_ALIASES)
		.map(([alias, canonical]) => [alias.toLowerCase(), NAME_TO_CODE[canonical.toLowerCase()]])
		.filter(([, code]) => Boolean(code))
);

export function respondentStateToCode(value: string): string | undefined {
	const raw = value.trim();
	if (!raw) return undefined;

	const upper = raw.toUpperCase();
	if (CODE_TO_NAME[upper]) return upper;

	const lower = raw.toLowerCase();
	if (NAME_TO_CODE[lower]) return NAME_TO_CODE[lower];
	if (ALIAS_TO_CODE[lower]) return ALIAS_TO_CODE[lower];

	return undefined;
}

export function respondentCodeToName(code: string): string | undefined {
	const raw = code.trim();
	if (!raw) return undefined;
	return CODE_TO_NAME[raw.toUpperCase()];
}

export function normalizeRespondentStates(values: string[]): string[] {
	const normalized = new Set<string>();
	for (const value of values) {
		const code = respondentStateToCode(value);
		if (code) normalized.add(code);
		else if (value.trim()) normalized.add(value.trim());
	}
	return Array.from(normalized);
}
