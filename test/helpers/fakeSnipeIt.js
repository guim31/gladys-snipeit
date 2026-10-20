// -----------------------------------------------------------------------------
// A fake Snipe-IT behind a `fetch` function, answering the bodies recorded on
// a real server (snipe/snipe-it v8.8.1, test/fixtures/snipeit/8.8.1/) on
// 2026-10-20, with the same status codes for a refused token (401), a user
// without the permission (403) and a deactivated user (401).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const HOST = 'http://192.0.2.40';
export const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.test-token';
export const LIMITED_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.limited-token';
// The token of a deactivated user: every request is a 401 `{ status: "error" }`.
export const INACTIVE_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.inactive-token';
// 2026-10-20, noon local time: the day the fixtures were recorded.
export const NOW = new Date(2026, 9, 20, 12).getTime();

export const fixture = (name, version = '8.8.1') =>
  readFileSync(new URL(`../fixtures/snipeit/${version}/${name}`, import.meta.url), 'utf8');

export const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const LISTS = ['hardware', 'licenses', 'consumables', 'maintenances'];

export function createSnipeIt() {
  const state = {
    lists: Object.fromEntries(LISTS.map((name) => [name, JSON.parse(fixture(`${name}.json`))])),
    version: fixture('version.json'),
    // Lists the limited token may read (a user with "View assets" only).
    limited: new Set(['hardware', 'maintenances']),
    down: false,
    html: false,
    pageSize: null,
    requests: [],
  };
  const answer = (status, body, type = 'application/json') =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': type },
    });

  async function fetch(url, init = {}) {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace(/^\/api\/v1/, '');
    state.requests.push(`${init.method ?? 'GET'} ${path}?${searchParams}`);
    if (state.down) {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (state.html) {
      return answer(200, '<html>Login</html>', 'text/html');
    }
    if (init.headers?.Accept !== 'application/json') {
      return answer(302, '', 'text/html');
    }
    const auth = init.headers?.Authorization;
    if (auth === `Bearer ${INACTIVE_TOKEN}`) {
      return answer(401, fixture('inactive-user.json'));
    }
    if (auth !== `Bearer ${TOKEN}` && auth !== `Bearer ${LIMITED_TOKEN}`) {
      return answer(401, fixture('unauthorized.json'));
    }
    if (path === '/version') {
      return answer(200, state.version);
    }
    const name = path.slice(1);
    if (!LISTS.includes(name)) {
      return answer(404, '<html>Not found</html>', 'text/html');
    }
    if (auth === `Bearer ${LIMITED_TOKEN}` && !state.limited.has(name)) {
      return answer(403, fixture('forbidden.json'));
    }
    // Paged like Snipe-IT: the server caps the limit.
    const list = state.lists[name];
    const limit = Math.min(Number(searchParams.get('limit')), state.pageSize ?? 500);
    const offset = Number(searchParams.get('offset'));
    return answer(200, {
      total: list.rows.length,
      rows: list.rows.slice(offset, offset + limit),
    });
  }

  return {
    fetch,
    state,
    goDown: () => {
      state.down = true;
    },
    goUp: () => {
      state.down = false;
    },
    rows: (name) => state.lists[name].rows,
    /** Change one row of a list: `edit(row)` mutates it. */
    edit: (name, id, edit) => {
      edit(state.lists[name].rows.find((row) => row.id === id));
    },
  };
}
