import { useEffect, useState } from 'react';
import { AnnotatedText } from './AnnotatedText';

type TypewriterTextProps = {
  text: string;
  speed?: number;
  className?: string;
  animateKey?: string;
  instant?: boolean;
};

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) return;
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return reducedMotion;
}

type PlaybackProps = Omit<TypewriterTextProps, 'animateKey'> & {
  reducedMotion: boolean;
};

function TypewriterPlayback({ text, speed = 16, className, instant = false, reducedMotion }: PlaybackProps) {
  const characters = Array.from(text);
  const showImmediately = instant || reducedMotion;
  const [visibleCount, setVisibleCount] = useState(showImmediately ? characters.length : 0);
  const finished = visibleCount >= characters.length;

  useEffect(() => {
    if (finished || showImmediately) return;
    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, characters.length));
    }, Math.max(0, speed));
    return () => window.clearTimeout(timer);
  }, [characters.length, finished, showImmediately, speed, visibleCount]);

  const revealAll = () => setVisibleCount(characters.length);
  const visibleText = characters.slice(0, visibleCount).join('');

  return (
    <span className={`typewriter-text${className ? ` ${className}` : ''}`} onClick={() => !finished && revealAll()}>
      <span className="typewriter-reserve" aria-hidden="true">{text}</span>
      <span className="typewriter-output" aria-live="polite">
        <AnnotatedText text={visibleText} />
        {!finished && <span className="typewriter-cursor" aria-hidden="true" />}
      </span>
      {!finished && (
        <button type="button" className="typewriter-skip" onClick={(event) => { event.stopPropagation(); revealAll(); }}>
          全文表示
        </button>
      )}
    </span>
  );
}

export function TypewriterText(props: TypewriterTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const playbackKey = `${props.animateKey ?? ''}:${props.text}:${props.instant ? 'instant' : 'animated'}:${reducedMotion ? 'reduced' : 'motion'}`;
  return <TypewriterPlayback key={playbackKey} {...props} reducedMotion={reducedMotion} />;
}
