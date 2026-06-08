import { useState } from 'react';
import type { PersonLog } from '../types';
import { AnnotatedText } from './AnnotatedText';

type PersonProfileProps = {
  person: PersonLog;
};

function PortraitFallback({ person }: PersonProfileProps) {
  if (!person.portraitFallback) return null;

  return (
    <div className="portrait-fallback" role="img" aria-label={`${person.name}の監査画像は未登録です`}>
      <span className="portrait-fallback-code">AUDIT // NO VISUAL RECORD</span>
      <strong>{person.portraitFallback.heading}</strong>
      <div>
        {person.portraitFallback.lines.map((line) => <span key={line}>{line}</span>)}
      </div>
    </div>
  );
}

export function PersonProfile({ person }: PersonProfileProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const showPortraitCard = Boolean(person.portrait);

  return (
    <article className="person-profile">
      {showPortraitCard && (
        <div className="person-portrait-column">
          <div className="person-portrait-frame">
            {portraitFailed ? (
              <PortraitFallback person={person} />
            ) : (
              <img
                src={person.portrait}
                alt={person.portraitAlt ?? `${person.name} 監査記録`}
                onError={() => setPortraitFailed(true)}
              />
            )}
          </div>
          {person.auditLabel && <p className="portrait-audit-label">{person.auditLabel}</p>}
        </div>
      )}
      <div className="person-profile-details">
        <p className="eyebrow">{person.auditLabels?.[0] ?? '人物記録'}</p>
        <h4>{person.name}</h4>
        <p className="person-role">{person.role}</p>
        <p><AnnotatedText text={person.summary} /></p>
        {person.auditLabels && (
          <dl className="person-audit-labels">
            {person.auditLabels.slice(1).map((label) => {
              const [term, ...value] = label.split('：');
              return (
                <div key={label}>
                  <dt>{term}</dt>
                  <dd>{value.join('：')}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </article>
  );
}
