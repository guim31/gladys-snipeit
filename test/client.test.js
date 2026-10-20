// The Snipe-IT client and the configuration, on the answers recorded on a real
// server (test/fixtures/snipeit/8.8.1/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeUrl } from '../src/config.js';
import { SnipeItClient, SnipeItError } from '../src/snipeit/client.js';
import { HOST, TOKEN, createSnipeIt, fixture } from './helpers/fakeSnipeIt.js';

const answering =
  (status, body, type = 'application/json') =>
  async () =>
    new Response(body, { status, headers: { 'content-type': type } });

async function kindOf(fetch) {
  const client = new SnipeItClient({ url: HOST, token: TOKEN, fetch, timeout: 100 });
  const err = await client.hardware().then(
    () => null,
    (error) => error,
  );
  assert.ok(err instanceof SnipeItError, String(err));
  return err.kind;
}

test('normalizeUrl: scheme, path, pasted API suffix, refused shapes', () => {
  assert.equal(normalizeUrl('192.0.2.40'), 'http://192.0.2.40');
  assert.equal(normalizeUrl(' 192.0.2.40:8080/ '), 'http://192.0.2.40:8080');
  assert.equal(normalizeUrl('https://example.org/snipeit/api/v1/'), 'https://example.org/snipeit');
  assert.equal(normalizeUrl('https://example.org/api'), 'https://example.org');
  for (const bad of ['', 'ftp://192.0.2.40', 'http://user:pw@192.0.2.40', 'http://x/?a=1', 42]) {
    assert.equal(normalizeUrl(bad), null, String(bad));
  }
});

test('normalizeConfig: defaults, bounds, a pasted "Bearer" and line breaks', () => {
  const config = normalizeConfig({
    url: 'snipeit.local',
    api_token: ' Bearer abc\ndef ',
    warranty_days: '400',
    license_days: '',
    refresh_minutes: '7',
    language: 'it',
  });
  assert.deepEqual(config, {
    url: 'http://snipeit.local',
    urlInvalid: false,
    apiToken: 'abcdef',
    warrantyDays: 365,
    licenseDays: 30,
    refreshMinutes: 60,
    language: 'fr',
  });
  assert.equal(normalizeConfig({ url: 'ftp://x' }).urlInvalid, true);
  assert.equal(normalizeConfig(null).url, null);
});

test('the client sends the token and Accept: application/json, and pages', async () => {
  const server = createSnipeIt();
  server.state.pageSize = 3;
  const client = new SnipeItClient({ url: HOST, token: TOKEN, fetch: server.fetch });
  const rows = await client.hardware();
  assert.equal(rows.length, 5);
  assert.deepEqual((await client.version()).version, 'v8.8.1');
  assert.deepEqual(server.state.requests.slice(0, 2), [
    'GET /hardware?limit=500&offset=0&sort=id&order=asc',
    'GET /hardware?limit=500&offset=3&sort=id&order=asc',
  ]);
});

test('errors: refused token, permission, deactivated user, login redirect, HTML, 200 error', async () => {
  assert.equal(await kindOf(answering(401, fixture('unauthorized.json'))), 'unauthorized');
  assert.equal(await kindOf(answering(403, fixture('forbidden.json'))), 'forbidden');
  assert.equal(await kindOf(answering(401, fixture('inactive-user.json'))), 'forbidden');
  assert.equal(await kindOf(answering(302, '', 'text/html')), 'invalid');
  assert.equal(await kindOf(answering(200, '<html>Login</html>', 'text/html')), 'invalid');
  assert.equal(await kindOf(answering(404, 'Not found', 'text/html')), 'not_found');
  assert.equal(await kindOf(answering(500, '{"status":"error","messages":"boom"}')), 'http');
  assert.equal(
    await kindOf(
      answering(200, '{"status":"error","messages":"Asset does not exist.","payload":null}'),
    ),
    'http',
  );
  assert.equal(await kindOf(answering(200, '{"total":1}')), 'invalid');
  assert.equal(
    await kindOf(async () => {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }),
    'unreachable',
  );
  assert.equal(
    await kindOf(
      (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason));
        }),
    ),
    'timeout',
  );
});

test('a server answering a wrong total does not loop forever', async () => {
  let calls = 0;
  const fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ total: 1e9, rows: [{ id: calls }] }), { status: 200 });
  };
  const client = new SnipeItClient({ url: HOST, token: TOKEN, fetch });
  const rows = await client.licenses();
  assert.equal(rows.length, 40);
  assert.equal(calls, 40);
});

test('no error message carries the token', async () => {
  for (const fetch of [answering(401, fixture('unauthorized.json')), answering(500, '{}')]) {
    const client = new SnipeItClient({ url: HOST, token: TOKEN, fetch });
    const err = await client.hardware().catch((error) => error);
    assert.ok(!err.message.includes(TOKEN));
  }
});
