// What reaches `docker logs` at the default level (info): the lifecycle only.
// A normal cycle (reads, published states, events, polls) writes nothing at
// info, an outage logs one line, and its recovery one more.
//
// The SDK logger writes through console.log (debug, info) and console.error
// (warn, error), re-reading LOG_LEVEL on every call: the tests capture both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, TOKEN, createSnipeIt } from './helpers/fakeSnipeIt.js';
import { DAY, createAll, createWorld } from './helpers/world.js';

function captureLogs(t) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  const captured = [];
  const record = (...args) => captured.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previous;
    }
  });
  return {
    all: () => [...captured],
    lines: () => captured.filter((line) => !line.includes('[DEBUG]') && line.includes('[snipeit-')),
    reset: () => captured.splice(0),
  };
}

test('a normal cycle writes nothing at info: reads, states, events, polls', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const start = logs.lines();
  assert.deepEqual(start.length, 1, start.join('\n'));
  assert.match(start[0], /Connected to Snipe-IT 8\.8\.1 \(5 assets\)/);
  logs.reset();
  for (let i = 0; i < 5; i += 1) {
    world.clock.now += DAY;
    await world.hub.refresh();
  }
  await world.fake.poll(world.fake.discoveredDevices[0]);
  assert.ok(world.fake.sceneEvents.length > 0, 'events were fired');
  assert.deepEqual(logs.lines(), [], 'nothing at info or above');
});

test('Snipe-IT down: one warning, nothing per attempt, one line when it is back', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  t.after(() => world.app.stop());
  logs.reset();
  world.server.goDown();
  for (let i = 0; i < 4; i += 1) {
    await world.hub.refresh();
  }
  const down = logs.lines();
  assert.equal(down.length, 1, down.join('\n'));
  assert.match(down[0], /\[WARN\].*Snipe-IT unreachable \(ECONNREFUSED\)/);
  logs.reset();
  world.server.goUp();
  await world.hub.refresh();
  const back = logs.lines();
  assert.equal(back.length, 1, back.join('\n'));
  assert.match(back[0], /\[INFO\].*Snipe-IT answers again \(5 assets\)/);
});

test('no token ever reaches the logs', async (t) => {
  const logs = captureLogs(t);
  for (const config of [
    { url: HOST, api_token: TOKEN },
    { url: HOST, api_token: 'eyJs3cr3t' },
  ]) {
    const world = await createWorld({ server: createSnipeIt(), config });
    await world.hub.refresh();
    await world.app.stop();
  }
  const all = logs.all().join('\n');
  for (const secret of [TOKEN, 'eyJs3cr3t']) {
    assert.ok(!all.includes(secret), secret);
  }
});
