import React from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';

/**
 * Renders article body text, source link, and comments teaser.
 * @param {{ excerpt: string, paragraphs: string[], sourceUrl: string }} props
 * @returns {JSX.Element}
 */
export default function ArticleContentBlock({ excerpt, paragraphs, sourceUrl }) {
  return (
    <>
      <div className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-blue-600 prose-img:rounded-xl">
        <p className="lead text-xl text-slate-600 mb-6 font-medium">{excerpt}</p>
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-6">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="border-t border-slate-200 mt-12 pt-8 space-y-4">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
        >
          Read Original Source
          <ExternalLink className="w-4 h-4" />
        </a>

        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-slate-500" />
          Comments (24)
        </h3>
        <div className="bg-slate-50 rounded-xl p-6 text-center">
          <p className="text-slate-600 mb-4">Join the conversation. Sign in to post comments.</p>
          <button type="button" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Sign In
          </button>
        </div>
      </div>
    </>
  );
}
