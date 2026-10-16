export type EndpointResult = { ok: true; url: string } | { ok: false; error: string };

const MAX_LENGTH = 200;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SAFE_PATH = /^[A-Za-z0-9/_.~-]*$/;

// Mirrors the checks in src-tauri/src/ai_http.rs, which is the enforcing side.
// The app appends /v1/... itself, so a pasted base that already ends in /v1 is trimmed.
export function normalizeEndpoint(input: string): EndpointResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Enter the endpoint URL.' };
  if (raw.length > MAX_LENGTH) return { ok: false, error: 'The endpoint URL is too long.' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'That is not a valid URL. Example: https://api.example.com' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'The endpoint must start with https://' };
  }
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) {
    return { ok: false, error: 'Plain http is only allowed for localhost. Use https://' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Do not put credentials in the URL; use the API key field.' };
  }
  if (url.search || url.hash) {
    return { ok: false, error: 'Remove the query string or fragment from the URL.' };
  }
  const path = url.pathname.replace(/\/+$/, '').replace(/\/v1$/, '');
  if (!SAFE_PATH.test(path) || path.includes('..') || path.includes('//')) {
    return { ok: false, error: 'The URL path contains unsupported characters.' };
  }
  return { ok: true, url: `${url.origin}${path}` };
}
