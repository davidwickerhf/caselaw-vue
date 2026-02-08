import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageToQueryBuilderGroup } from '../../lib/parser/nl-query-parser';

type Expectation = {
  field: string;
  value?: string;
  operator?: string;
  scope?: 'ANY' | 'ECHR' | 'RS';
};

function findRule(group: ReturnType<typeof parseNaturalLanguageToQueryBuilderGroup>, exp: Expectation) {
  const rules = [...group.rules, ...group.groups.flatMap((g) => g.rules)];
  return rules.find((r) => {
    if (r.field !== exp.field) return false;
    if (exp.value && r.value !== exp.value) return false;
    if (exp.operator && r.operator !== exp.operator) return false;
    if (exp.scope && r.sourceScope !== exp.scope) return false;
    return true;
  });
}

describe('natural language examples (EN + NL)', () => {
  const pairs: Array<{
    en: string;
    nl: string;
    expects: Expectation[];
    operator?: 'AND' | 'OR';
  }> = [
    {
      en: 'I want all documents from Germany in the year 2020 with Article 3 non-violated',
      nl: 'Ik wil alle documenten uit Duitsland in het jaar 2020 met artikel 3 niet geschonden',
      expects: [
        { field: 'respondent_state', value: 'Germany' },
        { field: 'year', value: '2020' },
        { field: 'article_non_violated', value: '3' }
      ]
    },
    {
      en: 'Documents in Turkey from 2014 to 2016',
      nl: 'Documenten in Turkije van 2014 tot 2016',
      expects: [
        { field: 'respondent_state', value: 'Turkey' },
        { field: 'year', operator: 'after', value: '2014' },
        { field: 'year', operator: 'before', value: '2016' }
      ]
    },
    {
      en: 'ECHR Article 2 violated and application number 12345/67',
      nl: 'EHRM artikel 2 geschonden en applicatienummer 12345/67',
      expects: [
        { field: 'article_violated', value: '2', scope: 'ECHR' },
        { field: 'application_number', value: '12345/67', scope: 'ECHR' }
      ]
    },
    {
      en: 'ECLI:CE:ECHR:2010:0101JUD000000000 from ECHR',
      nl: 'ECLI:CE:ECHR:2010:0101JUD000000000 van EHRM',
      expects: [
        { field: 'ecli', value: 'ECLI:CE:ECHR:2010:0101JUD000000000' },
        { field: 'source', value: 'ECHR' }
      ]
    },
    {
      en: 'Dutch case law Strafrecht 2019',
      nl: 'Nederlandse rechtspraak strafrecht 2019',
      expects: [
        { field: 'domain', value: 'Strafrecht', scope: 'RS' },
        { field: 'year', value: '2019' }
      ]
    },
    {
      en: 'ECHR Turkey or Armenia',
      nl: 'EHRM Turkije of Armenie',
      expects: [
        { field: 'respondent_state', value: 'Turkey', scope: 'ECHR' },
        { field: 'respondent_state', value: 'Armenia', scope: 'ECHR' }
      ],
      operator: 'OR'
    },
    {
      en: 'not Germany and Article 6',
      nl: 'niet Duitsland en artikel 6',
      expects: [
        { field: 'respondent_state', value: 'Germany', operator: 'not_equals' },
        { field: 'article_applied', value: '6' }
      ]
    },
    {
      en: '(Article 2 violated or Article 3 violated) and Turkey',
      nl: '(artikel 2 geschonden of artikel 3 geschonden) en Turkije',
      expects: [
        { field: 'article_violated', value: '2' },
        { field: 'article_violated', value: '3' },
        { field: 'respondent_state', value: 'Turkey' }
      ]
    },
    {
      en: 'Rechtspraak decision 2020',
      nl: 'rechtspraak beslissing 2020',
      expects: [
        { field: 'document_type', value: 'DEC' },
        { field: 'year', value: '2020' }
      ]
    },
    {
      en: 'ECHR Article 3 violated and Turkey',
      nl: 'EHRM artikel 3 geschonden en Turkije',
      expects: [
        { field: 'source', value: 'ECHR' },
        { field: 'article_violated', value: '3' },
        { field: 'respondent_state', value: 'Turkey' }
      ]
    },
    {
      en: '12 March 2020 to 5 May 2021',
      nl: '12 maart 2020 tot 5 mei 2021',
      expects: [
        { field: 'dateStart', operator: 'equals', value: '2020-03-12' },
        { field: 'dateEnd', operator: 'equals', value: '2021-05-05' }
      ]
    },
    {
      en: 'ECHR grand chamber judgment 2018',
      nl: 'EHRM grote kamer arrest 2018',
      expects: [
        { field: 'document_type', value: 'HECJUD', scope: 'ECHR' },
        { field: 'year', value: '2018' }
      ]
    },
    {
      en: 'app no. 10000/20 and ECLI:NL:HR:2021:1234',
      nl: 'applicatienummer 10000/20 en ECLI:NL:HR:2021:1234',
      expects: [
        { field: 'application_number', value: '10000/20' },
        { field: 'ecli', value: 'ECLI:NL:HR:2021:1234' }
      ]
    },
    {
      en: 'Rechtspraak cases 2021',
      nl: 'uitspraken 2021 rechtspraak',
      expects: [
        { field: 'year', value: '2021' },
        { field: 'source', value: 'RS' }
      ]
    },
    {
      en: 'ECHR respondent state France and decision 2010',
      nl: 'EHRM Frankrijk en beslissing 2010',
      expects: [
        { field: 'respondent_state', value: 'France', scope: 'ECHR' },
        { field: 'document_type', value: 'HEDEC' }
      ]
    },
    {
      en: 'language ENG and judgment date on 2020-05-01',
      nl: 'taal ENG en arrestdatum op 2020-05-01',
      expects: [
        { field: 'language', value: 'ENG', scope: 'ECHR' },
        { field: 'date_judgment_start', value: '2020-05-01', operator: 'equals', scope: 'ECHR' }
      ]
    },
    {
      en: 'selected law BWBX1234|56 and Rechtspraak',
      nl: 'geselecteerde wet BWBX1234|56 en rechtspraak',
      expects: [
        { field: 'selectedLaws', value: 'BWBX1234|56', scope: 'RS' },
        { field: 'source', value: 'RS' }
      ]
    },
    {
      en: 'title "freedom of expression" 2019',
      nl: 'titel "freedom of expression" 2019',
      expects: [
        { field: 'title', value: 'freedom of expression' },
        { field: 'year', value: '2019' }
      ]
    }
  ];

  for (const example of pairs) {
    const cases: Array<{ label: string; text: string }> = [
      { label: 'EN', text: example.en },
      { label: 'NL', text: example.nl }
    ];

    for (const { label, text } of cases) {
      it(`${label}: ${text}`, () => {
        const group = parseNaturalLanguageToQueryBuilderGroup(text);
        if (example.operator) {
          expect(group.operator).toBe(example.operator);
        }
        for (const exp of example.expects) {
          const found = findRule(group, exp);
          expect(found, `Missing ${exp.field} in "${text}"`).toBeTruthy();
        }
      });
    }
  }
});
