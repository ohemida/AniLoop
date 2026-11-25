// Faster media: large remote screenshots (often ~500 KB PNGs) and covers are served
// through the free, open-source wsrv.nl image CDN as resized WebP (~25 KB, edge
// cached). Every proxied <img> carries data-original, and the app's image error
// handler falls back to the original URL if the CDN is unavailable.
const PROXY_HOSTS = /^https:\/\/(cms\.aniguessr\.com|medias\.aniguessr\.com|cdn\.myanimelist\.net|s4\.anilist\.co)\//;
const warmed = new Set();

export function fastImage(url, width = 960) {
  if (typeof url !== 'string' || !PROXY_HOSTS.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&we&output=webp&q=78`;
}

/** src + data-original attributes for an <img>, already HTML-escaped. */
export function fastSrc(url, width, esc) {
  const fast = fastImage(url, width);
  return fast === url ? `src="${esc(url)}"` : `src="${esc(fast)}" data-original="${esc(url)}"`;
}

/** Restores the original URL when the CDN copy fails. Returns true if it handled the error. */
export function recoverImage(img) {
  const original = img?.dataset?.original;
  if (!original || img.dataset.recovered) return false;
  img.dataset.recovered = '1';
  img.src = original;
  return true;
}

/** Starts downloading images in the background so the next clue or question appears instantly. */
export function warmImages(urls, width = 960) {
  for (const url of urls) {
    const fast = fastImage(url, width);
    if (!fast || warmed.has(fast)) continue;
    warmed.add(fast);
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = 'low';
    img.src = fast;
  }
}
