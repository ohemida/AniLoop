// Discard email-confirmation codes/legacy implicit tokens; login uses the server.
// Does not read game storage, exchange tokens, fetch anything or authenticate users.
export function cleanAuthReturn(value) {
  const url = new URL(value),
    query = url.searchParams,
    fragment = new URLSearchParams(url.hash.slice(1));
  let changed = false;
  const code = query.get('code') || '';
  if (query.has('code')) {
    query.delete('code');
    changed = true;
  }
  if (fragment.has('access_token') || fragment.has('refresh_token') || fragment.has('error_description')) {
    url.hash = '';
    changed = true;
  }
  return {url: url.href, changed, code};
}
