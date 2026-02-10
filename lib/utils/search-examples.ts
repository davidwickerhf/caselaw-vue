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
    'Portugal',
    'Norway',
    'Sweden',
    'Denmark',
    'Ireland',
    'Czech Republic',
    'Austria'
];

const NL_COUNTRIES_TOP = [
    'Turkije',
    'Frankrijk',
    'Italie',
    'Roemenië',
    'Polen',
    'Spanje',
    'Griekenland',
    'Belgie'
];

const YEARS = [
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
    '2024'
];

const ARTICLES = ['2', '3', '5', '6', '8', '10', '14'];

const DOMAINS = [
    'Strafrecht',
    'Civiel recht',
    'Bestuursrecht',
    'Belastingrecht',
    'Arbeidsrecht',
    'Vreemdelingenrecht',
    'Intellectueel-eigendomsrecht',
    'Personen- en familierecht',
    'Ondernemingsrecht'
];

const INSTANCES = [
    'Hoge Raad',
    'Raad van State',
    'Rechtbank Amsterdam',
    'Rechtbank Den Haag',
    'Gerechtshof Arnhem-Leeuwarden',
    'Gerechtshof Den Haag',
    'Rechtbank Rotterdam',
    'Rechtbank Noord-Holland'
];


const KEYWORDS = [
    '"right to life"',
    '"freedom of expression"',
    '"fair trial"',
    '"private life"',
    '"property rights"',
    '"due process"',
    '"asylum seeker"',
    '"data protection"',
    '"family life"'
];

const TITLES = [
    '"freedom of expression"',
    '"right to life"',
    '"privacy and family life"',
    '"fair trial"',
    '"property rights"',
    '"data protection"'
];

const LANGUAGES = ['ENG', 'FRA', 'DEU', 'NLD'];

const DATE_EXACTS = [
    '2018-03-12',
    '2019-05-01',
    '2020-01-15',
    '2021-09-30',
    '2022-06-10'
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
        const year = pick(YEARS, i);
        const article = pick(ARTICLES, i);
        const domain = pick(DOMAINS, i);
        const instance = pick(INSTANCES, i);
        const keyword = pick(KEYWORDS, i);
        const title = pick(TITLES, i);
        const language = pick(LANGUAGES, i);
        const exactDate = pick(DATE_EXACTS, i);
        const [start, end] = pickRange(i);

        switch (i % 20) {
            case 0:
                examples.add(`Cases in ${country} in ${year}`);
                break;
            case 1:
                examples.add(`Cases in ${country} from ${start} to ${end}`);
                break;
            case 2:
                examples.add(`ECHR Article ${article} violated in ${country}`);
                break;
            case 3:
                examples.add(`ECHR Article ${article} non-violated in ${country}`);
                break;
            case 4:
                examples.add(`ECHR judgment ${country} ${year}`);
                break;
            case 5:
                examples.add(`Rechtspraak ${domain} ${year}`);
                break;
            case 6:
                examples.add(`Rechtspraak ${instance} ${year}`);
                break;
            case 7:
                examples.add(`EHRM artikel ${article} geschonden in ${pick(NL_COUNTRIES_TOP, i)}`);
                break;
            case 8:
                examples.add(`EHRM artikel ${article} niet geschonden in ${pick(NL_COUNTRIES_TOP, i)}`);
                break;
            case 9:
                examples.add(`Cases in ${country} with Article ${article}`);
                break;
            case 10:
                examples.add(`ECHR judgment in ${country} between ${start} and ${end}`);
                break;
            case 11:
                examples.add(`ECHR ${keyword} between ${start} and ${end}`);
                break;
            case 12:
                examples.add(`ECHR ${keyword} ${country}`);
                break;
            case 13:
                examples.add(`ECHR Article ${article} violated ${year}`);
                break;
            case 14:
                examples.add(`Rechtspraak ${domain} ${instance} ${year}`);
                break;
            case 15:
                examples.add(`title ${title}`);
                break;
            case 16:
                examples.add(`language ${language} judgment date on ${exactDate}`);
                break;
            case 17:
                examples.add(`decision date before ${exactDate} ${keyword}`);
                break;
            case 18:
                examples.add(`Rechtspraak ${instance} between ${start} and ${end}`);
                break;
            case 19:
                examples.add(`Rechtspraak ${domain} between ${start} and ${end}`);
                break;
            default:
                break;
        }

        i += 1;
    }

    return Array.from(examples).slice(0, 200);
}

export const SEARCH_EXAMPLES = buildExamples();
