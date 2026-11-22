import type { CitationSource } from '~/lib/types';
import { DataSource } from '~/lib/types';

/** The three corpora, keyed by the dataset code the API uses. */
export type Dataset = 'RS' | 'ECHR' | 'CJEU';

const DATASET_TO_SOURCE: Record<Dataset, CitationSource> = {
    RS: 'Rechtspraak',
    ECHR: 'HUDOC',
    CJEU: 'CJEU',
};

/** Dataset code for a document's display source. */
export function datasetForSource(source: string | undefined | null): Dataset {
    if (source === 'HUDOC' || source === 'ECHR') return 'ECHR';
    if (source === 'CJEU') return 'CJEU';
    return 'RS';
}

export function sourceForDataset(dataset: string | undefined | null): CitationSource {
    const upper = String(dataset || '').toUpperCase();
    if (upper === 'ECHR' || upper === 'HUDOC') return 'HUDOC';
    if (upper === 'CJEU') return 'CJEU';
    return DATASET_TO_SOURCE.RS;
}

/** Dataset from an ECLI: ECLI:CE:ECHR:… → ECHR, ECLI:EU:… → CJEU, ECLI:NL:… → RS. */
export function datasetFromEcli(ecli: string | undefined | null): Dataset | null {
    const upper = String(ecli || '').toUpperCase();
    if (upper.startsWith('ECLI:CE:ECHR:')) return 'ECHR';
    if (upper.startsWith('ECLI:EU:')) return 'CJEU';
    if (upper.startsWith('ECLI:NL:')) return 'RS';
    return null;
}

/** Full name for headers and labels. */
export function sourceLabel(source: string | undefined | null): string {
    const ds = datasetForSource(source);
    if (ds === 'ECHR') return 'ECHR';
    if (ds === 'CJEU') return 'CJEU';
    return 'Rechtspraak';
}

/** Short badge text where space is tight. */
export function sourceShortLabel(source: string | undefined | null): string {
    const ds = datasetForSource(source);
    return ds === 'RS' ? 'RS' : ds;
}

/** Badge variant per corpus, so the three stay distinguishable. */
export function sourceBadgeVariant(source: string | undefined | null): 'default' | 'secondary' | 'outline' {
    const ds = datasetForSource(source);
    if (ds === 'ECHR') return 'default';
    if (ds === 'CJEU') return 'outline';
    return 'secondary';
}

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
    [DataSource.ECHR]: 'ECHR',
    [DataSource.RS]: 'Rechtspraak',
    [DataSource.CJEU]: 'CJEU',
};

/** Parse a user- or URL-supplied source name. */
export function parseDataSource(value: string | undefined | null): DataSource | null {
    const upper = String(value || '').trim().toUpperCase();
    if (upper === 'ECHR' || upper === 'HUDOC') return DataSource.ECHR;
    if (upper === 'RS' || upper === 'RECHTSPRAAK') return DataSource.RS;
    if (upper === 'CJEU' || upper === 'CURIA' || upper === 'EU' || upper === 'EURLEX') return DataSource.CJEU;
    return null;
}
