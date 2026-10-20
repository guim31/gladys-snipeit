// -----------------------------------------------------------------------------
// The REST API of Snipe-IT (`<base>/api/v1/...`), the few calls the
// integration needs. Read only: the integration never writes to Snipe-IT.
//
// Facts checked on a real server (snipe/snipe-it v8.8.1, see
// test/fixtures/snipeit/):
// - a personal access token (Bearer) and `Accept: application/json` are
//   required: without that header, an API error is answered as a redirect to
//   the login page (HTML);
// - lists answer `{ total, rows }`, paged by `limit` and `offset`; the server
//   caps `limit` (500 by default, `max_results`); archived and deleted assets
//   are left out of `/hardware` by default;
// - a wrong token is a 401 `{"error":"Unauthorized or unauthenticated."}`, a
//   user without the permission a 401 `{"status":"error","messages":...}`;
// - some errors come as a 200 with `{"status":"error","messages":...}`, where
//   `messages` may be a string or an object of validation errors.
// -----------------------------------------------------------------------------

export const DEFAULT_TIMEOUT = 20_000;
export const PAGE_SIZE = 500;
// 40 pages of 500: far beyond a home or small-office inventory, and a bound
// against a server answering a wrong `total` forever.
const MAX_PAGES = 40;

export class SnipeItError extends Error {
  /**
   * @param {'unreachable' | 'unauthorized' | 'forbidden' | 'not_found' | 'timeout' | 'http' | 'invalid'} kind
   * @param {string} message never carries a credential
   * @param {number} [status]
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'SnipeItError';
    this.kind = kind;
    this.status = status;
  }
}

export class SnipeItClient {
  /**
   * @param {object} options
   * @param {string} options.url normalized base URL (see normalizeUrl)
   * @param {string} options.token personal access token
   * @param {typeof fetch} [options.fetch]
   * @param {number} [options.timeout]
   */
  constructor({ url, token, fetch: fetchImpl, timeout }) {
    this.url = url;
    this.token = token;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.timeout = timeout ?? DEFAULT_TIMEOUT;
  }

  /** GET `<base>/api/v1<path>`, parsed JSON. */
  async get(path) {
    let response;
    try {
      response = await this.fetch(`${this.url}/api/v1${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(this.timeout),
        // A redirect means the login page, never data: refused below.
        redirect: 'manual',
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new SnipeItError('timeout', `No answer from Snipe-IT within ${this.timeout} ms`);
      }
      const cause = err?.cause?.code ?? err?.cause?.message ?? err?.message ?? 'error';
      throw new SnipeItError('unreachable', `Snipe-IT unreachable (${cause})`);
    }
    const raw = await response.text().catch(() => '');
    const where = path.split('?')[0];
    let data;
    try {
      data = raw === '' ? null : JSON.parse(raw);
    } catch {
      data = undefined;
    }
    const status = response.status;
    if (status === 401 || status === 403) {
      // A refused token answers `{ error }`; a valid token whose user lacks
      // the permission answers `{ status: "error", messages }`, in 401 too.
      const kind = status === 403 || data?.status === 'error' ? 'forbidden' : 'unauthorized';
      throw new SnipeItError(kind, `${where}: HTTP ${status}`, status);
    }
    if (status >= 300 && status < 400) {
      throw new SnipeItError('invalid', `${where}: redirected (is this the Snipe-IT address?)`);
    }
    if (status === 404) {
      throw new SnipeItError('not_found', `${where}: HTTP 404`, status);
    }
    if (status < 200 || status >= 300) {
      const detail = typeof data?.messages === 'string' ? `: ${data.messages.slice(0, 120)}` : '';
      throw new SnipeItError('http', `${where}: HTTP ${status}${detail}`, status);
    }
    if (data === undefined) {
      // A proxy login page answering 200 in HTML, for instance.
      throw new SnipeItError('invalid', `${where}: the answer is not JSON (is this Snipe-IT?)`);
    }
    // Snipe-IT answers some errors with a 200 and `status: "error"`.
    if (data && data.status === 'error') {
      const detail = typeof data.messages === 'string' ? data.messages : 'error';
      const kind = /unauthori[sz]ed|permission/i.test(detail) ? 'forbidden' : 'http';
      throw new SnipeItError(kind, `${where}: ${detail.slice(0, 120)}`, status);
    }
    return data;
  }

  /**
   * Every row of a list, page after page.
   * @param {string} path e.g. `/hardware`
   * @param {Record<string, string>} [query]
   */
  async list(path, query = {}) {
    const rows = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        ...query,
        limit: String(PAGE_SIZE),
        offset: String(rows.length),
        sort: 'id',
        order: 'asc',
      });
      const data = await this.get(`${path}?${params}`);
      if (!data || !Array.isArray(data.rows)) {
        throw new SnipeItError('invalid', `${path}: Snipe-IT did not answer a list`);
      }
      rows.push(...data.rows);
      const total = Number(data.total);
      if (data.rows.length === 0 || !Number.isFinite(total) || rows.length >= total) {
        break;
      }
    }
    return rows;
  }

  hardware() {
    return this.list('/hardware');
  }

  licenses() {
    return this.list('/licenses');
  }

  consumables() {
    return this.list('/consumables');
  }

  maintenances() {
    return this.list('/maintenances');
  }

  /** `{ version, build_version, ... }` */
  version() {
    return this.get('/version');
  }
}
