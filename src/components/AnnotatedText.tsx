import { useMemo, useState } from 'react';
import { glossaryEntries } from '../data/glossary';
import type { GlossaryEntry } from '../types';

type AnnotatedTextProps = {
  text: string;
  className?: string;
};

type TextPart =
  | { kind: 'text'; value: string }
  | { kind: 'glossary'; value: string; entry: GlossaryEntry };

const aliases = glossaryEntries
  .flatMap((entry) => entry.aliases.map((alias) => ({ alias, entry })))
  .sort((left, right) => right.alias.length - left.alias.length);

function annotateText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let plainText = '';
  let index = 0;

  while (index < text.length) {
    const match = aliases.find(({ alias }) => text.startsWith(alias, index));
    if (!match) {
      plainText += text[index];
      index += 1;
      continue;
    }

    if (plainText) {
      parts.push({ kind: 'text', value: plainText });
      plainText = '';
    }
    parts.push({ kind: 'glossary', value: match.alias, entry: match.entry });
    index += match.alias.length;
  }

  if (plainText) parts.push({ kind: 'text', value: plainText });
  return parts;
}

export function AnnotatedText({ text, className }: AnnotatedTextProps) {
  const parts = useMemo(() => annotateText(text), [text]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.kind === 'text') return <span key={`${index}-${part.value}`}>{part.value}</span>;

        const tooltipId = `glossary-${part.entry.id}-${index}`;
        const isOpen = openIndex === index;
        return (
          <span className="glossary-anchor" key={`${index}-${part.value}`}>
            <button
              type="button"
              className="annotated-keyword"
              aria-describedby={isOpen ? tooltipId : undefined}
              aria-expanded={isOpen}
              onMouseEnter={() => setOpenIndex(index)}
              onMouseLeave={() => setOpenIndex((current) => current === index ? null : current)}
              onFocus={() => setOpenIndex(index)}
              onBlur={() => setOpenIndex((current) => current === index ? null : current)}
              onClick={(event) => {
                event.stopPropagation();
                setOpenIndex((current) => current === index ? null : index);
              }}
            >
              {part.value}
            </button>
            <span id={tooltipId} role="tooltip" className="glossary-tooltip" data-open={isOpen || undefined}>
              <strong>{part.entry.term}</strong>
              <span>{part.entry.definition}</span>
            </span>
          </span>
        );
      })}
    </span>
  );
}
