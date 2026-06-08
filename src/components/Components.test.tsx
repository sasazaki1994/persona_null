import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { glossaryEntries } from '../data/glossary';
import { AnnotatedText } from './AnnotatedText';
import { TypewriterText } from './TypewriterText';

const requiredTerms = [
  '義体',
  '警備用部分義体',
  '都市OS',
  '人格署名',
  '身体認証',
  '人格認証',
  '操作主体',
  '法的人格',
  '公定値',
  'KASUMI-GATE-09',
  '間宮怜司',
  '七瀬未織',
  '監査室',
  '都市警備局',
];

describe('glossaryEntries', () => {
  it('contains every required Case000 term', () => {
    expect(glossaryEntries.map((entry) => entry.term)).toEqual(expect.arrayContaining(requiredTerms));
  });
});

describe('AnnotatedText', () => {
  it('annotates required terms without injecting HTML', () => {
    const markup = renderToStaticMarkup(<AnnotatedText text="義体を都市OSで照合し、間宮怜司を確認する。" />);

    expect(markup.match(/class="annotated-keyword"/g)).toHaveLength(3);
    expect(markup).toContain('義体');
    expect(markup).toContain('都市OS');
    expect(markup).toContain('間宮怜司');
    expect(markup).toContain('role="tooltip"');
  });

  it('matches longer aliases before shorter aliases', () => {
    const markup = renderToStaticMarkup(<AnnotatedText text="警備用部分義体" />);

    expect(markup.match(/class="annotated-keyword"/g)).toHaveLength(1);
    expect(markup).toContain('警備用部分義体');
  });
});

describe('TypewriterText', () => {
  it('shows the full annotated text immediately when instant is enabled', () => {
    const markup = renderToStaticMarkup(<TypewriterText text="都市OSが義体を照合する。" instant />);

    expect(markup).toContain('都市OSが');
    expect(markup).toContain('義体');
    expect(markup).toContain('annotated-keyword');
    expect(markup).not.toContain('typewriter-cursor');
    expect(markup).not.toContain('全文表示');
  });
});
