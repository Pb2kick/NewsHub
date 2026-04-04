import React from 'react';

/**
 * Renders reusable page header with title and optional actions.
 * @param {{ title: string, subtitle?: string, actions?: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export default function AdminPageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
