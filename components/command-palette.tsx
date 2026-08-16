'use client';

/**
 * Command palette — Cmd/Ctrl+K.
 *
 * A dashboard this size has five screens, five branches, thirty reps and seven
 * vehicles. Reaching any of them by pointing is three or four clicks through
 * menus that each need a decision. This is one keystroke and a substring.
 *
 * The index is built on the server and passed in as plain strings, so the
 * 620KB dataset stays where it is; the client receives roughly fifty labels
 * and hrefs. Everything the palette can do is reachable without it — it is an
 * accelerator, never the only path.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  /** Shown after the label — the branch a rep belongs to, a vehicle's revenue. */
  hint?: string;
  group: string;
  href?: string;
  /** Client-side actions: copying the current URL, printing. */
  action?: 'copy-link' | 'print';
}

/**
 * Subsequence match, not substring: "hyc" finds "Innova Hycross" and "dwn"
 * finds "Downtown". Returns null when the query does not match at all, and a
 * lower score for a better match so ordering is a plain sort.
 */
function score(query: string, text: string): number | null {
  if (query === '') return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const direct = t.indexOf(q);
  // A contiguous run always beats a scattered subsequence, and an earlier one
  // beats a later one.
  if (direct !== -1) return direct === 0 ? 0 : 1 + direct;
  let qi = 0;
  let gaps = 0;
  let last = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (last !== -1) gaps += ti - last - 1;
      last = ti;
      qi++;
    }
  }
  return qi === q.length ? 100 + gaps : null;
}

export function CommandPalette({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Focus returns to whatever opened the palette, as with the lead drawer. */
  const restoreTo = useRef<HTMLElement | null>(null);

  const results = useMemo(() => {
    const scored: { item: CommandItem; s: number }[] = [];
    for (const item of items) {
      const s = score(query, `${item.label} ${item.hint ?? ''}`);
      if (s !== null) scored.push({ item, s });
    }
    scored.sort((a, b) => a.s - b.s);
    return scored.slice(0, 40).map((x) => x.item);
  }, [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
    setCopied(false);
    restoreTo.current?.focus();
  }, []);

  const run = useCallback(
    (item: CommandItem) => {
      if (item.action === 'copy-link') {
        // `writeText` rejects without a secure context or permission; the URL
        // is shown in the palette either way so it can still be copied by hand.
        navigator.clipboard?.writeText(window.location.href).then(
          () => setCopied(true),
          () => setCopied(false),
        );
        return;
      }
      if (item.action === 'print') {
        close();
        window.print();
        return;
      }
      if (item.href) {
        close();
        router.push(item.href);
      }
    },
    [close, router],
  );

  // Open on Cmd/Ctrl+K from anywhere, but never while the user is typing into
  // a field — a search box would otherwise lose the shortcut it needs itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        restoreTo.current = document.activeElement as HTMLElement;
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view when the cursor moves by keyboard.
  useEffect(() => {
    listRef.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor, query]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (results.length === 0 ? 0 : (c + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (results.length === 0 ? 0 : (c - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[cursor];
      if (item) run(item);
    } else if (e.key === 'Tab') {
      // The palette is modal: focus stays on the field, which is the only
      // control it has.
      e.preventDefault();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="cmdk-open"
        onClick={() => {
          restoreTo.current = document.activeElement as HTMLElement;
          setOpen(true);
        }}
        aria-label="Open the command palette"
      >
        <span className="cmdk-open-t">Search</span>
        <kbd className="cmdk-kbd">⌘K</kbd>
      </button>
    );
  }

  let lastGroup = '';

  return (
    <>
      <button type="button" className="cmdk-open" aria-hidden="true" tabIndex={-1}>
        <span className="cmdk-open-t">Search</span>
        <kbd className="cmdk-kbd">⌘K</kbd>
      </button>
      <div className="cmdk-scrim" onClick={close} />
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          className="cmdk-in"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onInputKey}
          placeholder="Jump to a branch, a rep, a vehicle, a screen…"
          aria-label="Search commands"
          aria-controls="cmdk-list"
          autoComplete="off"
        />
        <ul className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {results.length === 0 ? (
            <li className="cmdk-empty">Nothing matches “{query}”.</li>
          ) : (
            results.map((item, i) => {
              const head = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const on = i === cursor;
              return (
                <li key={item.id}>
                  {head ? <p className="cmdk-group">{head}</p> : null}
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="cmdk-row"
                      data-on={on}
                      role="option"
                      aria-selected={on}
                      onMouseEnter={() => setCursor(i)}
                      onClick={close}
                    >
                      <span className="cmdk-lab">{item.label}</span>
                      {item.hint ? <span className="cmdk-hint">{item.hint}</span> : null}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="cmdk-row"
                      data-on={on}
                      role="option"
                      aria-selected={on}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => run(item)}
                    >
                      <span className="cmdk-lab">{item.label}</span>
                      <span className="cmdk-hint">
                        {item.action === 'copy-link' && copied ? 'copied' : (item.hint ?? '')}
                      </span>
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
        <footer className="cmdk-ft">
          <span>
            <kbd className="cmdk-kbd">↑↓</kbd> move
          </span>
          <span>
            <kbd className="cmdk-kbd">↵</kbd> open
          </span>
          <span>
            <kbd className="cmdk-kbd">esc</kbd> close
          </span>
        </footer>
      </div>
    </>
  );
}
