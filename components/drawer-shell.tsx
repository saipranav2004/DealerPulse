'use client';

/**
 * The only client component on the drill-down screens.
 *
 * It exists for behaviours static markup cannot provide: dismiss on Escape,
 * dismiss on backdrop click, and the focus contract a modal owes a keyboard
 * user — focus moves in on open, cannot leave while open, and returns to the
 * row that opened it on close. Everything inside it is server-rendered.
 */

import { useCallback, useEffect, useRef } from 'react';
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

  /** Everything inside the panel a keyboard can reach, in document order. */
  const focusables = useCallback((): HTMLElement[] => {
    const panel = panelRef.current;
    if (!panel) return [];
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((node) => node.offsetParent !== null || node === document.activeElement);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        router.push(closeHref, { scroll: false });
        return;
      }
      if (event.key !== 'Tab') return;

      // The trap. Without it, Tab walks out of an open modal and into the page
      // behind it, which a screen reader has already been told is inert.
      const nodes = focusables();
      if (nodes.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeHref, router, focusables]);

  /*
   * Focus moves to the panel on open and returns to whatever opened it on
   * close. Returning matters more than entering: without it a keyboard user
   * who closes the drawer is dropped back at the top of the document and has
   * to walk the whole page again to reach the next row.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
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
