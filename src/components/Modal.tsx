import { useEffect, useRef, type ReactNode } from 'react';

type ModalProps = {
  label?: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

/**
 * Generic audit-room modal. Closes on Escape, backdrop click, and the close
 * button, and locks body scroll while open. Reused by the investigation node /
 * person / decision dialogs and the case overview person dialog so the audit
 * UI keeps a single, consistent modal behaviour.
 */
export function Modal({ label = 'OPEN RECORD FILE', onClose, className, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="audit-modal-backdrop" onMouseDown={() => onCloseRef.current()}>
      <section
        className={`audit-modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="audit-modal-shell-label">
          <span>{label}</span>
          <button type="button" className="audit-modal-close" onClick={() => onCloseRef.current()}>閉じる</button>
        </div>
        {children}
      </section>
    </div>
  );
}
