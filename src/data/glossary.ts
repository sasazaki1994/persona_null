import type { GlossaryEntry } from '../types';

export const glossaryEntries: GlossaryEntry[] = [
  {
    id: 'security-cyborg',
    term: '警備用部分義体',
    aliases: ['警備用部分義体'],
    definition: '都市警備業務向けに身体の一部を機械化した義体。認証系と行動ログが都市OSへ接続される。',
  },
  {
    id: 'cyborg-body',
    term: '義体',
    aliases: ['義体'],
    definition: '生体の代替または補助として接続された人工身体。身体の所有者と操作主体が一致するとは限らない。',
  },
  {
    id: 'city-os',
    term: '都市OS',
    aliases: ['都市OS', '都市 OS'],
    definition: '北霞市の認証、行政判断、通行、医療などを統合管理する都市基盤システム。',
  },
  {
    id: 'persona-signature',
    term: '人格署名',
    aliases: ['人格署名'],
    definition: '応答や操作記録から人格の同一性を照合するための署名情報。',
  },
  {
    id: 'body-authentication',
    term: '身体認証',
    aliases: ['身体認証'],
    definition: '身体の登録情報を照合し、その身体が誰に帰属するかを判定する認証。',
  },
  {
    id: 'persona-authentication',
    term: '人格認証',
    aliases: ['人格認証'],
    definition: '現在応答している人格が登録された誰であるかを判定する認証。',
  },
  {
    id: 'operation-subject',
    term: '操作主体',
    aliases: ['操作主体'],
    definition: '身体や義体、端末へ実際に指示を与え、動作させた主体。法的な所有者とは限らない。',
  },
  {
    id: 'legal-persona',
    term: '法的人格',
    aliases: ['法的人格'],
    definition: '都市OSが権利、責任、同意などの主体として公的に承認した人格。',
  },
  {
    id: 'official-value',
    term: '公定値',
    aliases: ['公定値'],
    definition: '都市OSが行政手続き上の事実として採用した値。真実そのものとは限らない。',
  },
  {
    id: 'kasumi-gate-09',
    term: 'KASUMI-GATE-09',
    aliases: ['KASUMI-GATE-09'],
    definition: '旧式の都市境界認証規格に由来する識別子。Case000の認証痕に残されている。',
  },
  {
    id: 'reiji-mamiya',
    term: '間宮怜司',
    aliases: ['間宮怜司', '間宮'],
    definition: '都市警備局所属の捜査官。Case000で発砲に使用された警備用部分義体の登録者。',
  },
  {
    id: 'miori-nanase',
    term: '七瀬未織',
    aliases: ['七瀬未織'],
    definition: 'Case000の被害者。未登録人格媒体と、焼却されなかった音声記録が事件に残る。',
  },
  {
    id: 'audit-office',
    term: '監査室',
    aliases: ['監査室'],
    definition: '都市OSが判断不能とした案件の記録と根拠を再検証する部門。',
  },
  {
    id: 'urban-security-bureau',
    term: '都市警備局',
    aliases: ['都市警備局'],
    definition: '北霞市の治安維持と警備記録を管轄する行政組織。',
  },
];
