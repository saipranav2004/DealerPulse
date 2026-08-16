'use client';

/**
 * Saved views.
 *
 * Filter state already lives entirely in the URL, so a "view" is just a name
 * and a query string — there is no separate model to keep in step. Saving one
 * stores the path plus the query exactly as it stands; opening one navigates
 * there. Nothing about a lead or a figure is stored, only the coordinates.
 *
 * localStorage rather than a server: this build has no accounts, and a view
 * that silently belonged to everyone would be worse than one that plainly
 * belongs to this browser. The menu says so.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const KEY = 'dp-views-v1';
const MAX = 12;

interface SavedView {
  id: string;
  name: string;
  /** Path plus query, e.g. `/leads?period=q4&branch=B5`. */
  href: string;
}

function read(): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything in localStorage is untrusted input: it may be from an older
    // build, hand-edited, or another app's key collision.
    return parsed
      .filter(
        (v): v is SavedView =>
          !!v && typeof v === 'object' &&
          typeof (v as SavedView).id === 'string' &&
          typeof (v as SavedView).name === 'string' &&
          typeof (v as SavedView).href === 'string' &&
          // Same-origin, path-only. Never navigate to a stored absolute URL.
          (v as SavedView).href.startsWith('/') &&
          !(v as SavedView).href.startsWith('//'),
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(views: SavedView[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(views.slice(0, MAX)));
  } catch {
    /* Private mode, or the quota is full. The menu still works for this page. */
  }
}

export function SavedViews({
  currentHref,
  suggestedName,
}: {
  /** Path + query for the view as it stands, built on the server. */
  currentHref: string;
  /** What this view would be called if the user does not rename it. */
  suggestedName: string;
}) {
  const router = useRouter();
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => setViews(read()), []);
  useEffect(() => {
    if (naming) nameInput.current?.select();
  }, [naming]);

  // Close on outside click or Escape, matching the filter menus' behaviour.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setNaming(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const save = useCallback(() => {
    const name = draft.trim() || suggestedName;
    const next = [
      { id: `${Date.now()}`, name, href: currentHref },
      // Saving the same coordinates twice replaces rather than duplicates.
      ...views.filter((v) => v.href !== currentHref),
    ].slice(0, MAX);
    setViews(next);
    write(next);
    setNaming(false);
    setDraft('');
  }, [draft, suggestedName, currentHref, views]);

  const remove = (id: string) => {
    const next = views.filter((v) => v.id !== id);
    setViews(next);
    write(next);
  };

  const alreadySaved = views.some((v) => v.href === currentHref);

  return (
    <div className="sv" ref={box}>
      <button
        type="button"
        className={open ? 'filter is-active' : 'filter'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 2h8v12l-4-3-4 3V2z" strokeLinejoin="round" />
        </svg>
        Views
        {views.length > 0 ? <span className="fb-count num">{views.length}</span> : null}
      </button>

      {open ? (
        <div className="sv-pop" role="menu">
          {views.length === 0 ? (
            <p className="sv-none">
              No saved views yet. Save the filters you come back to — a branch, a quarter, a vehicle — and
              they reopen in one click.
            </p>
          ) : (
            <ul className="sv-list">
              {views.map((view) => (
                <li key={view.id} className="sv-item">
                  <button
                    type="button"
                    className="sv-go"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      router.push(view.href);
                    }}
                  >
                    <span className="sv-name">{view.name}</span>
                    <span className="sv-href">{view.href}</span>
                  </button>
                  <button
                    type="button"
                    className="sv-del"
                    aria-label={`Delete the saved view ${view.name}`}
                    onClick={() => remove(view.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="sv-foot">
            {naming ? (
              <form
                className="sv-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                <input
                  ref={nameInput}
                  className="sv-in"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={suggestedName}
                  aria-label="Name for this view"
                  maxLength={60}
                />
                <button type="submit" className="btn btn-sm btn-primary">
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setDraft(suggestedName);
                  setNaming(true);
                }}
              >
                {alreadySaved ? 'Save again under a new name' : 'Save this view'}
              </button>
            )}
            <p className="sv-note">Stored in this browser only.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
