'use client';

/**
 * The keyboard shortcut sheet, on `?`.
 *
 * This exists because the search trigger is an icon: the ⌘K hint is no longer
 * printed in the top bar, so there has to be somewhere the shortcut is
 * discoverable. `?` is the convention every product that hides its shortcuts
 * behind one uses, and the sheet is also linked from the palette itself.
 *
 * Nothing here is the only way to do anything — every row names a shortcut for
 * something that is also a visible control.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      ['Ctrl K', 'Search branches, people and vehicles'],
      ['?', 'This list'],
      ['Esc', 'Close whatever is open'],
    ],
  },
  {
    title: 'In search',
    keys: [
      ['↑ ↓', 'Move through results'],
      ['↵', 'Open the highlighted result'],
    ],
  },
  {
    title: 'Reading a screen',
    keys: [
      ['Tab', 'Step through every control in order'],
      ['↵', 'Follow the focused link'],
    ],
  },
];

export function Shortcuts() {
  const [open, setOpen] = useState(false);
  const restoreTo = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    restoreTo.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      // Never while typing: "?" is a character before it is a command.
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        restoreTo.current = el as HTMLElement;
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="cmdk-scrim" onClick={close} />
      <div className="cmdk sc" role="dialog" aria-modal="true" aria-labelledby="sc-h">
        <header className="sc-hd">
          <h2 id="sc-h" className="t-h2">
            Keyboard shortcuts
          </h2>
          <button ref={closeRef} type="button" className="btn btn-sm" onClick={close}>
            Close
          </button>
        </header>
        <div className="sc-bd">
          {GROUPS.map((group) => (
            <section key={group.title} className="sc-g">
              <p className="t-label">{group.title}</p>
              <dl className="sc-l">
                {group.keys.map(([key, what]) => (
                  <div key={key} className="sc-r">
                    <dt>
                      <kbd className="cmdk-kbd">{key}</kbd>
                    </dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <footer className="cmdk-ft">
          <span>Every shortcut here has a visible control too — nothing is keyboard-only.</span>
        </footer>
      </div>
    </>
  );
}
