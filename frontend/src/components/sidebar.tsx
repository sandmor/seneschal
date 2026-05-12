import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTheme } from '@/providers/theme-provider';
import { cn } from '@/lib/utils';
import { AdminConsole } from '@/features/rbac/admin-console';
import { logout, getStoredAuthToken, storeAuthToken } from '@/features/auth/auth-api';

type SidebarProps = {
  breadcrumbs?: { label: string; path: string }[];
  currentPath?: string;
  directoryCount: number;
  documentCount: number;
  onNavigate?: (path: string) => void;
};

export function Sidebar({
  breadcrumbs = [],
  currentPath = '',
  directoryCount,
  documentCount,
  onNavigate,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [adminOpen, setAdminOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const token = getStoredAuthToken();
      if (token) await logout(token);
    } finally {
      storeAuthToken(null);
      setSigningOut(false);
      void navigate({ to: '/auth' });
    }
  };

  return (
    <>
      <nav className="flex h-full flex-col" id="sidebar-nav">
        <div className="px-5 pt-6 pb-4">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Seneschal
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Document management</p>
        </div>

        <div className="mx-3 h-px bg-border" />

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Navigation
          </p>
          <ul className="space-y-0.5">
            {breadcrumbs.map((crumb, index) => {
              const isActive = crumb.path === currentPath;
              return (
                <li key={crumb.path}>
                  <button
                    type="button"
                    className={cn(
                      'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                    style={{ paddingLeft: `${index * 12 + 10}px` }}
                    onClick={() => onNavigate?.(crumb.path)}
                  >
                    {isActive && (
                      <span className="mr-0.5 inline-block h-4 w-0.5 rounded-full bg-primary" />
                    )}
                    <FolderIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{index === 0 ? 'Root archive' : crumb.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mx-3 h-px bg-border" />

        {/* Admin console button */}
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ShieldIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span>Admin console</span>
          </button>
        </div>

        <div className="mx-3 h-px bg-border" />

        <div className="flex items-center justify-between px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {directoryCount} dir{directoryCount !== 1 && 's'} · {documentCount} doc
            {documentCount !== 1 && 's'}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              id="theme-toggle"
            >
              {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
              aria-label="Sign out"
              title="Sign out"
            >
              <SignOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <AdminConsole open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}

const FolderIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 7.75A2.75 2.75 0 0 1 5.75 5h4.39a2 2 0 0 1 1.42.59l1.1 1.1a2 2 0 0 0 1.42.58h4.17A2.75 2.75 0 0 1 21 10.02v6.23A2.75 2.75 0 0 1 18.25 19H5.75A2.75 2.75 0 0 1 3 16.25z" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SignOutIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const SunIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);