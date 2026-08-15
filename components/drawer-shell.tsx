'use client';

/**
 * The only client component on the drill-down screens.
 *
 * It exists for two behaviours static markup cannot provide: dismiss on Escape
 * and dismiss on backdrop click. Everything inside it is server-rendered.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function DrawerShell({
  closeHref,
  label,
  children,
}: {
  closeHref: string;
  label: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') router.push(closeHref, { scroll: false });
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeHref, router]);

  // Move focus into the panel so keyboard users land inside the drawer.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="drawer-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) router.push(closeHref, { scroll: false });
      }}
    >
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
