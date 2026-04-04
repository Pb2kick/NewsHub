import React from 'react';

/**
 * Renders standardized loading/error/empty view for admin tables.
 * @param {{ loading: boolean, error: string, isEmpty: boolean, emptyText: string }} props
 * @returns {JSX.Element | null}
 */
export default function AdminDataState({ loading, error, isEmpty, emptyText }) {
  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading data...</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }
  if (isEmpty) {
    return <div className="p-6 text-sm text-slate-500">{emptyText}</div>;
  }
  return null;
}
