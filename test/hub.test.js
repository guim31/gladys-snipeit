// The integration end to end: the SDK's fake Gladys, the wiring of
// src/app.js and the fake Snipe-IT built on real answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { MemoryStore } from '../src/store.js';
import { TRIGGERS, WIDGET_KEY } from '../src/hub.js';
import {
  HOST,
  INACTIVE_TOKEN,
  LIMITED_TOKEN,
  NOW,
  createSnipeIt,
  settle,
} from './helpers/fakeSnipeIt.js';
import { DAY, DEVICE, createAll, createWorld, feature } from './helpers/world.js';

test('one Snipe-IT device, its states once added to Gladys', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(device.external_id, DEVICE);
  assert.equal(device.model, 'Snipe-IT 8.8.1');
  assert.equal(device.should_poll, false);
  assert.equal(world.fake.states.length, 0, 'nothing before the device is added');
  assert.equal(world.fake.connectionStatus.connected, true);

  await createAll(world.fake);
  const last = (key) => world.fake.lastState(feature(key));
  assert.equal(last('assets'), 5, 'the archived asset is not listed by Snipe-IT');
  assert.equal(last('checked_out'), 3);
  assert.equal(last('warranties_expiring'), 2, 'Home server (25/10) and Laptop Alice (02/11)');
  assert.equal(last('licenses_expiring'), 2, 'Antivirus (22/10) and Office 365 (05/11)');
  assert.equal(last('consumables_low'), 1, 'the ink, at its minimum; the tape has none');
  assert.equal(last('audits_overdue'), 1);
  assert.equal(last('checkins_overdue'), 1);
  assert.equal(last('maintenances_in_progress'), 3, 'started and not completed');
  assert.equal(last('next_deadline'), 'Licence · Antivirus · 22/10/2026');
  assert.ok(world.fake.widgetRefreshes.includes(WIDGET_KEY));
});

test('feature names follow the language; a new address keeps the device', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_token: 'x', language: 'en' } });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  await world.fake.configUpdated({
    url: `${HOST}/api/v1/`,
    api_token: `Bearer ${(await import('./helpers/fakeSnipeIt.js')).TOKEN}`,
    language: 'en',
  });
  await settle(20);
  const [device] = world.fake.discoveredDevices;
  assert.equal(device.external_id, DEVICE);
  assert.deepEqual(
    device.features.map((f) => f.name),
    [
      'Assets',
      'Checked-out assets',
      'Warranties expiring soon',
      'Licenses expiring soon',
      'Consumables below minimum',
      'Overdue audits',
      'Overdue check-ins',
      'Maintenances in progress',
      'Next deadline',
    ],
  );
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('triggers: a silent baseline, then each deadline once', async (t) => {
  const store = new MemoryStore();
  const clock = { now: NOW };
  const world = await createWorld({ store, clock });
  t.after(() => world.app.stop());
  assert.equal(world.fake.sceneEvents.length, 0, 'what is pending at install is not announced');
  assert.equal(store.data.warranty.length, 2);

  // Four days later: Laptop Bob was expected back on 23/10.
  clock.now = NOW + 4 * DAY;
  await world.hub.refresh();
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data]),
    [
      [
        TRIGGERS.checkin,
        {
          asset: 'Laptop Bob',
          asset_tag: 'LAP-002',
          assigned_to: 'Bob Durand',
          expected: '23/10/2026',
          days_late: 1,
        },
      ],
    ],
  );
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 1, 'once');

  // 21/12: the warranty of Laptop Bob (10/01/2027) enters the 30-day window.
  clock.now = NOW + 62 * DAY;
  await world.hub.refresh();
  const warranty = world.fake.sceneEvents.find((e) => e.key === TRIGGERS.warranty);
  assert.deepEqual(warranty.data, {
    asset: 'Laptop Bob',
    asset_tag: 'LAP-002',
    model: 'ThinkPad T14',
    expires: '10/01/2027',
    days_left: 20,
  });
});

test('license and consumable triggers; a consumable is announced again once restocked', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  // Paper A4 falls to its minimum.
  world.server.edit('consumables', 2, (row) => {
    row.remaining = 3;
  });
  // A new license, expiring in 10 days.
  world.server.rows('licenses').push({
    ...world.server.rows('licenses')[0],
    id: 9,
    name: 'VPN',
    seats: 4,
    expiration_date: { date: '2026-10-30', formatted: '2026-10-30' },
  });
  await world.hub.refresh();
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data]),
    [
      [TRIGGERS.license, { license: 'VPN', seats: 4, expires: '30/10/2026', days_left: 10 }],
      [TRIGGERS.consumable, { consumable: 'Paper A4', remaining: 3, minimum: 3 }],
    ],
  );
  world.server.edit('consumables', 2, (row) => {
    row.remaining = 10;
  });
  await world.hub.refresh();
  world.server.edit('consumables', 2, (row) => {
    row.remaining = 1;
  });
  await world.hub.refresh();
  assert.deepEqual(
    world.fake.sceneEvents.slice(2).map((e) => e.data.remaining),
    [1],
  );
});

test('a restart does not announce again; another Snipe-IT is a new baseline', async (t) => {
  const store = new MemoryStore();
  const clock = { now: NOW + 4 * DAY };
  const first = await createWorld({ store, clock: { now: NOW } });
  await first.app.stop();
  const again = await createWorld({ store, clock });
  t.after(() => again.app.stop());
  assert.equal(again.fake.sceneEvents.length, 1, 'only the check-in due meanwhile');
  const other = await createWorld({
    store,
    clock,
    config: { url: 'http://192.0.2.41', api_token: 'x' },
  });
  t.after(() => other.app.stop());
  assert.equal(other.fake.sceneEvents.length, 0);
});

test('a token that may only read assets: the other counts stay empty', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_token: LIMITED_TOKEN } });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, true);
  await createAll(world.fake);
  assert.equal(world.fake.lastState(feature('assets')), 5);
  assert.equal(world.fake.lastState(feature('warranties_expiring')), 2);
  assert.equal(world.fake.lastState(feature('maintenances_in_progress')), 3);
  for (const key of ['licenses_expiring', 'consumables_low']) {
    assert.equal(world.fake.lastState(feature(key)), undefined, key);
  }
  world.server.state.limited = new Set();
  await world.hub.refresh();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /may not view the assets/);
});

test('the token of a deactivated user is reported as such', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_token: INACTIVE_TOKEN } });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /may not view the assets/);
});

test('connection status: address, token, refused token, not Snipe-IT, down', async (t) => {
  const cases = [
    [{}, /Enter the address/],
    [{ url: 'ftp://192.0.2.40' }, /not valid/],
    [{ url: HOST }, /API token/],
    [{ url: HOST, api_token: 'wrong' }, /Token refused/],
  ];
  for (const [config, message] of cases) {
    const world = await createWorld({ config });
    t.after(() => world.app.stop());
    assert.equal(world.fake.connectionStatus.connected, false);
    assert.match(world.fake.connectionStatus.message.en, message);
  }
  const html = createSnipeIt();
  html.state.html = true;
  const proxy = await createWorld({ server: html });
  t.after(() => proxy.app.stop());
  assert.match(proxy.fake.connectionStatus.message.en, /does not answer like Snipe-IT/);

  const world = await createWorld();
  t.after(() => world.app.stop());
  world.server.goDown();
  await world.hub.refresh();
  assert.match(world.fake.connectionStatus.message.fr, /ne répond pas/);
  world.server.goUp();
  await world.hub.refresh();
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('lists are read page after page', async (t) => {
  const server = createSnipeIt();
  server.state.pageSize = 2;
  const world = await createWorld({ server });
  t.after(() => world.app.stop());
  await createAll(world.fake);
  assert.equal(world.fake.lastState(feature('assets')), 5);
  const pages = server.state.requests.filter((r) => r.startsWith('GET /hardware?'));
  assert.deepEqual(
    pages.map((r) => new URLSearchParams(r.split('?')[1]).get('offset')),
    ['0', '2', '4'],
  );
});

test('the widget: tiles and the deadlines of the week, late first', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language });
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], language);
  }
  const { content } = (await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'fr' }))
    .data;
  assert.ok(content.components.length <= 8);
  assert.deepEqual(
    content.components.slice(0, 4).map((c) => [c.label, c.value]),
    [
      ['Matériels', 5],
      ['Prêtés', 3],
      ['Expirent', 4],
      ['Stock bas', 1],
    ],
  );
  const list = content.components[4];
  assert.equal(list.type, 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.badge.text, item.title, item.subtitle]),
    [
      ['Audit', 'Laptop Bob', '19 jour(s) de retard · 01/10/2026'],
      ['Maintenance', 'Screen repair · Kids & guests "Pi"', '10 jour(s) de retard · 10/10/2026'],
      ['Retour', 'Laptop Alice · Alice Martin', '5 jour(s) de retard · 15/10/2026'],
      ['Licence', 'Antivirus', 'Dans 2 jour(s) · 22/10/2026'],
      ['Retour', 'Laptop Bob · Bob Durand', 'Dans 3 jour(s) · 23/10/2026'],
      ['Audit', 'Kids & guests "Pi"', 'Dans 4 jour(s) · 24/10/2026'],
      ['Maintenance', 'Battery replacement · Laptop Bob', 'Dans 4 jour(s) · 24/10/2026'],
      ['Garantie', 'Home server', 'Dans 5 jour(s) · 25/10/2026'],
    ],
  );
});

test('the widget before the first read asks to check the configuration', async (t) => {
  const world = await createWorld({ config: {} });
  t.after(() => world.app.stop());
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'de' });
  assert.match(ack.data.content.components[0].text, /Warte auf Snipe-IT/);
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
});

test('the scene action reads the week, in the configured language', async (t) => {
  const world = await createWorld({
    config: { url: HOST, api_token: (await import('./helpers/fakeSnipeIt.js')).TOKEN },
  });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('read_week', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.count, 8);
  assert.equal(ack.data.outputs.late, 3);
  assert.equal(
    ack.data.outputs.text,
    '8 échéance(s) dans Snipe-IT : Audit Laptop Bob (19 jour(s) de retard), ' +
      'Maintenance Screen repair · Kids & guests "Pi" (10 jour(s) de retard), ' +
      'Retour Laptop Alice (5 jour(s) de retard), Licence Antivirus (22/10/2026), ' +
      'Retour Laptop Bob (23/10/2026), Audit Kids & guests "Pi" (24/10/2026) et 2 autre(s).',
  );
  world.server.goDown();
  const failed = await world.fake.sceneAction('read_week', {});
  assert.equal(failed.success, false);
  assert.match(failed.error, /ne répond pas/);
});

test('test_connection reports the version and the counts', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.match(JSON.stringify(ack.data), /Snipe-IT 8\.8\.1 answers: 5 asset\(s\), 4 license\(s\)/);
});

test('onPoll and onDeviceCreated publish the states again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const before = world.fake.states.length;
  await world.fake.poll(world.fake.discoveredDevices[0]);
  await settle();
  assert.ok(world.fake.states.length >= before);
  await world.fake.deviceCreated(world.fake.discoveredDevices[0]);
  await settle();
  assert.ok(world.fake.states.length >= before + 9, 'everything again after a creation');
});

test('the container reads Snipe-IT on its own timer', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const world = await createWorld();
  t.after(() => world.app.stop());
  const reads = () => world.server.state.requests.filter((r) => r.startsWith('GET /hardware'));
  assert.equal(reads().length, 1);
  t.mock.timers.tick(60 * 60_000);
  await settle(20);
  assert.equal(reads().length, 2, 'one more read after an hour, without onPoll');
});
