import React from 'react';

/**
 * Displays a compact status pill.
 * @param {{ value: string }} props
 * @returns {JSX.Element}
 */
export default function AdminStatusBadge({ value }) {
  const normalized = String(value || '').toUpperCase();
  const classes =
    normalized === 'APPROVED' || normalized === 'ACTIVE'
      ? 'bg-green-100 text-green-700'
      : normalized === 'REJECTED' || normalized === 'ENDED'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${classes}`}>{normalized || 'UNKNOWN'}</span>;
}
