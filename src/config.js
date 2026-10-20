// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const REFRESH_MINUTES = ['15', '30', '60', '180', '360'];
export const WARRANTY_DAYS = { min: 1, max: 365, default: 30 };
export const LICENSE_DAYS = { min: 1, max: 365, default: 30 };

export const DEFAULT_CONFIG = {
  url: '',
  api_token: '',
  warranty_days: WARRANTY_DAYS.default,
  license_days: LICENSE_DAYS.default,
  refresh_minutes: '60',
  language: 'fr',
};

/**
 * Turn what the user typed into the base URL of Snipe-IT, without `/api/v1`:
 * - `192.0.2.10` or `snipeit.local` (no scheme): http, default port;
 * - `https://example.org/snipeit/`: exactly that address (reverse proxy).
 * A pasted `/api/v1` suffix is dropped. Returns null when it is not usable.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  let url;
  try {
    url = new URL(hasScheme ? text : `http://${text}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname === '') {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) {
    // Credentials in the URL would end up in logs and error messages.
    return null;
  }
  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/api(\/v1)?$/i, '')
    .replace(/\/+$/, '');
  return `${url.protocol}//${url.host}${path}`;
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function integer(value, { min, max, default: fallback }) {
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || value === '') {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const typed = text(source.url);
  const url = normalizeUrl(typed);
  // A token pasted with its scheme ("Bearer eyJ...") works as well.
  const apiToken = text(source.api_token)
    .replace(/^bearer\s+/i, '')
    // Spaces, line breaks and control characters cannot be part of a token.
    // eslint-disable-next-line no-control-regex
    .replace(/[\s\x00-\x1f\x7f]+/g, '');
  const refresh = String(source.refresh_minutes ?? '');
  return {
    url,
    urlInvalid: typed !== '' && url === null,
    apiToken,
    warrantyDays: integer(source.warranty_days, WARRANTY_DAYS),
    licenseDays: integer(source.license_days, LICENSE_DAYS),
    refreshMinutes: Number(
      REFRESH_MINUTES.includes(refresh) ? refresh : DEFAULT_CONFIG.refresh_minutes,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
