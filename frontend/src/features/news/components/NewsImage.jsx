import React, { useMemo, useState } from 'react';
import { getProxiedImageUrl } from '../services/newsApi';

/**
 * Renders an article image with graceful fallback when loading fails.
 *
 * All image requests are routed through the backend image-proxy endpoint
 * (/api/news/image-proxy) so the browser never makes direct requests to
 * publisher domains. This prevents 403 errors from server-side hotlink
 * protection — which referrerPolicy="no-referrer" cannot solve because
 * publishers inspect the request's Origin/Referer on their server, not in
 * the browser.
 *
 * @param {{ src: string, alt: string, className: string, fallbackClassName: string }} props
 * @returns {JSX.Element}
 */
export default function NewsImage({ src, alt, className, fallbackClassName }) {
  const [isBroken, setIsBroken] = useState(false);

  /**
   * Builds a proxied URL for the raw image source.
   * Returns an empty string when src is blank or non-HTTP so the fallback
   * div is rendered instead of a broken image request.
   * @returns {string}
   */
  const proxiedSource = useMemo(() => getProxiedImageUrl(src), [src]);

  if (!proxiedSource || isBroken) {
    return <div className={fallbackClassName} />;
  }

  return (
    <img
      src={proxiedSource}
      alt={alt}
      loading="lazy"
      onError={() => setIsBroken(true)}
      className={className}
    />
  );
}

