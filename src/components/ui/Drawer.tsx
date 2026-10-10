import { useEffect, useId, useRef, type ReactNode } from "react";

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  widthClass = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  widthClass?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
      (firstField ?? focusable()[0])?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 z-0 bg-hph-blue/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section className={`absolute inset-y-0 right-0 z-10 flex w-full ${widthClass} animate-[drawer-slide-in_200ms_ease-out] flex-col overflow-hidden rounded-l-xl border-l border-brand-100 bg-surface shadow-popover`}>
        <header className="flex items-start justify-between gap-4 border-b border-border bg-brand-50/60 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-content-primary">{title}</h2>
            {description && <p className="mt-1 text-sm text-content-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close drawer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-content-muted hover:bg-surface-inset hover:text-content-primary"
            onClick={onClose}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 5 10 10m0-10L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </section>
    </div>
  );
}
