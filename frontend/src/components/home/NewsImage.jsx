import React, { useMemo, useState } from 'react';

/**
 * Renders an article image with graceful fallback when loading fails.
 * @param {{ src: string, alt: string, className: string, fallbackClassName: string }} props
 * @returns {JSX.Element}
 */
export default function NewsImage({ src, alt, className, fallbackClassName }) {
  const [isBroken, setIsBroken] = useState(false);

  /**
   * Returns a normalized URL candidate for rendering.
   * @returns {string}
   */
  const safeSource = useMemo(() => {
    if (typeof src !== 'string') {
      return '';
    }
    const trimmed = src.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return '';
    }
    return trimmed;
  }, [src]);

  if (!safeSource || isBroken) {
    return <div className={fallbackClassName} />;
  }

  return (
    <img
      src={safeSource}
      alt={alt}
      loading="lazy"
      onError={() => setIsBroken(true)}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
