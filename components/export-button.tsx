'use client';

/**
 * CSV export. Takes already-formatted rows so the client never needs the
 * dataset or the formatters' business rules.
 */

import { useCallback } from 'react';

function escape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ExportButton({
  headers,
  rows,
  filename,
  label = 'Export CSV',
}: {
  headers: string[];
  rows: string[][];
  filename: string;
  label?: string;
}) {
  const download = useCallback(() => {
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [headers, rows, filename]);

  return (
    <button type="button" className="btn btn-sm" onClick={download} disabled={rows.length === 0}>
      {label}
    </button>
  );
}
