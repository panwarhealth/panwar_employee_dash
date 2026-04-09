import type { ReactNode } from 'react';

/**
 * Layout for unauthenticated pages (login, error states). Centred card on a
 * neutral background with the PH wordmark up top.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-ph-charcoal/5 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-ph-purple">Panwar Health</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
