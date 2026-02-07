const EN_COUNTRIES = [
    'Germany',
    'France',
    'Turkey',
    'Armenia',
    'Netherlands',
    'Italy',
    'Spain',
    'Poland',
    'Belgium',
    'Switzerland',
    'Greece',
    'Portugal'
];

const NL_COUNTRIES = [
    'Duitsland',
    'Frankrijk',
    'Turkije',
    'Armenie',
    'Nederland',
    'Italie',
    'Spanje',
    'Polen',
    'Belgie',
    'Zwitserland',
    'Griekenland',
    'Portugal'
];

const YEARS = [
    '2010',
    '2011',
    '2012',
    '2013',
    '2014',
    '2015',
    '2016',
    '2017',
    '2018',
    '2019',
    '2020',
    '2021',
    '2022',
    '2023',
    '2024',
    '2025',
    '2026'
];

const ARTICLES = ['2', '3', '5', '6', '8', '10', '14', 'P1-1'];

const DOMAINS = [
    'Strafrecht',
    'Civiel recht',
    'Bestuursrecht',
    'Belastingrecht',
    'Arbeidsrecht',
    'Vreemdelingenrecht'
];

const INSTANCES = [
    'Hoge Raad',
    'Raad van State',
    'Rechtbank Amsterdam',
    'Rechtbank Den Haag',
    'Gerechtshof Arnhem-Leeuwarden',
    'Gerechtshof Den Haag'
];

const DOC_TYPES_EN = [
    'judgment',
    'decision',
    'grand chamber judgment',
    'communicated case'
];

const DOC_TYPES_NL = [
    'beslissing',
    'uitspraak',
    'grote kamer arrest',
    'communicated case'
];

const KEYWORDS = [
    '"right to life"',
    '"freedom of expression"',
    '"fair trial"',
    '"private life"',
    '"property rights"',
    '"due process"'
];

function pick<T>(list: T[], index: number): T {
    return list[index % list.length];
}

function pickRange(index: number): [string, string] {
    const start = YEARS[index % YEARS.length];
    const end = YEARS[(index + 4) % YEARS.length];
    if (Number(end) > Number(start)) return [start, end];
    return [end, start];
}

function buildExamples(): string[] {
    const examples = new Set<string>();
    let i = 0;
    const maxTries = 2000;

    while (examples.size < 200 && i < maxTries) {
        const country = pick(EN_COUNTRIES, i);
        const countryNl = pick(NL_COUNTRIES, i);
        const year = pick(YEARS, i);
        const article = pick(ARTICLES, i);
        const domain = pick(DOMAINS, i);
        const instance = pick(INSTANCES, i);
        const docEn = pick(DOC_TYPES_EN, i);
        const docNl = pick(DOC_TYPES_NL, i);
        const keyword = pick(KEYWORDS, i);
        const [start, end] = pickRange(i);
        const app = `${10000 + i}/${(10 + (i % 90)).toString().padStart(2, '0')}`;

        switch (i % 12) {
            case 0:
                examples.add(`Cases in ${country} in ${year}`);
                break;
            case 1:
                examples.add(`Cases in ${country} from ${start} to ${end}`);
                break;
            case 2:
                examples.add(`ECHR Article ${article} violated in ${country} ${year}`);
                break;
            case 3:
                examples.add(`ECHR Article ${article} non-violated in ${country}`);
                break;
            case 4:
                examples.add(`ECHR ${docEn} ${year}`);
                break;
            case 5:
                examples.add(`Rechtspraak ${domain} ${year}`);
                break;
            case 6:
                examples.add(`Rechtspraak ${instance} ${year}`);
                break;
            case 7:
                examples.add(`EHRM artikel ${article} geschonden in ${countryNl}`);
                break;
            case 8:
                examples.add(`EHRM artikel ${article} niet geschonden in ${countryNl}`);
                break;
            case 9:
                examples.add(`Uitspraken in ${countryNl} in ${year}`);
                break;
            case 10:
                examples.add(`EHRM ${docNl} ${year}`);
                break;
            case 11:
                examples.add(`ECHR application number ${app} and ${keyword}`);
                break;
            default:
                break;
        }

        i += 1;
    }

    return Array.from(examples).slice(0, 200);
}

export const SEARCH_EXAMPLES = buildExamples();
