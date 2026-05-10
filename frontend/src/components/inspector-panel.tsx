import { PropsWithChildren, useEffect } from 'react';
import { cn } from '@/lib/utils';

type InspectorPanelProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
}>;

/**
 * InspectorPanel is a slide-over panel that appears from the right side of the screen.
 * It is used to display details and controls for a selected item (e.g., directory).
 */
export function InspectorPanel({ open, onClose, title, children }: InspectorPanelProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-40 flex h-full w-full flex-col border-l border-border bg-card shadow-2xl transition-transform duration-250 ease-out sm:w-105',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close panel"
            id="inspector-close"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}

const CloseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
