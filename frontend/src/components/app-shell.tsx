import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type AppShellProps = PropsWithChildren<{
  sidebar: React.ReactNode;
}>;

export function AppShell({ sidebar, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [sidebarOpen, closeSidebar]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        {sidebar}
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
            onClick={closeSidebar}
          />
          <aside className="relative z-50 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-xl animate-in slide-in-from-left duration-200">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Open sidebar"
            id="mobile-menu-toggle"
          >
            <MenuIcon className="h-4 w-4" />
          </button>
          <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
            Seneschal
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

type InspectorPanelProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
}>;

/**
 * InspectorPanel is a slide-over panel that appears from the right side of the screen.
 * It is used to display details about a selected document or directory, and allows editing of its properties.
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

const MenuIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
