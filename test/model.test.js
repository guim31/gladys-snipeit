// The model: Snipe-IT rows -> facts, and the summary of a day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayOf,
  daysBetween,
  isLow,
  parseAsset,
  parseMaintenance,
  plain,
  summarize,
} from '../src/snipeit/model.js';
import { fixture } from './helpers/fakeSnipeIt.js';

const rows = (name) => JSON.parse(fixture(`${name}.json`)).rows;

test('dates: date objects, datetimes, strings, nothing', () => {
  assert.equal(dayOf({ date: '2026-11-02', formatted: '2026-11-02' }), '2026-11-02');
  assert.equal(dayOf({ datetime: '2026-10-15 00:00:00', formatted: 'x' }), '2026-10-15');
  assert.equal(dayOf('2026-10-15'), '2026-10-15');
  assert.equal(dayOf(null), null);
  assert.equal(dayOf('soon'), null);
  assert.equal(daysBetween('2026-10-20', '2026-11-02'), 13);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2, 'across a DST change');
  assert.equal(daysBetween('2026-10-20', '2026-10-15'), -5);
});

test('texts escaped by Snipe-IT are shown as typed', () => {
  assert.equal(plain('Kids &amp; guests &quot;Pi&quot;'), 'Kids & guests "Pi"');
  assert.equal(plain('O&#039;Brien &lt;3'), "O'Brien <3");
  assert.equal(plain(null), '');
});

test('assets: name, falling back to the model or the tag', () => {
  const assets = rows('hardware').map(parseAsset);
  const untitled = assets.find((asset) => asset.tag === 'PI-003');
  assert.equal(untitled.name, 'Raspberry Pi 5');
  const alice = assets.find((asset) => asset.tag === 'LAP-001');
  assert.deepEqual(
    [alice.assignedTo, alice.warranty, alice.audit, alice.expectedCheckin],
    ['Alice Martin', '2026-11-02', '2027-03-01', '2026-10-15'],
  );
  assert.equal(parseAsset({ id: 7, status_label: { status_meta: 'archived' } }).archived, true);
});

test('maintenances: v8.6+ (completed_at) and older versions (completion_date only)', () => {
  const today = '2026-10-20';
  const current = rows('maintenances').map((row) => parseMaintenance(row, today));
  assert.deepEqual(
    current.map((m) => [m.title, m.asset, m.start, m.end, m.done]),
    [
      ['Battery replacement', 'Laptop Bob', '2026-10-18', '2026-10-24', false],
      ['Disk check', 'Home server', '2026-10-19', null, false],
      ['Fan cleaning', 'Laptop Alice', '2026-09-01', '2026-09-03', true],
      ['Screen repair', 'Kids & guests "Pi"', '2026-10-01', '2026-10-10', false],
      ['Yearly check', 'PI-003', '2026-11-10', '2026-11-12', false],
    ],
  );
  // Snipe-IT v7: `title`, and `completion_date` is the day it was completed.
  const old = (completion) =>
    parseMaintenance(
      {
        id: 1,
        title: 'Repair',
        asset: { name: 'Laptop' },
        start_date: { date: '2026-10-01' },
        completion_date: completion && { date: completion },
      },
      today,
    );
  assert.deepEqual([old(null).done, old(null).end], [false, null]);
  assert.deepEqual([old('2026-10-05').done, old('2026-10-05').end], [true, '2026-10-05']);
  assert.deepEqual([old('2026-10-25').done, old('2026-10-25').title], [false, 'Repair']);
});

test('low stock: at or under a minimum above zero', () => {
  assert.equal(isLow({ remaining: 2, minimum: 2 }), true);
  assert.equal(isLow({ remaining: 3, minimum: 2 }), false);
  assert.equal(isLow({ remaining: 0, minimum: 0 }), false);
});

test('the summary of a day: windows are inclusive, the past is not expiring', () => {
  const data = {
    assets: [
      parseAsset({ id: 1, warranty_expires: { date: '2026-10-20' } }),
      parseAsset({ id: 2, warranty_expires: { date: '2026-11-19' } }),
      parseAsset({ id: 3, warranty_expires: { date: '2026-11-20' } }),
      parseAsset({ id: 4, warranty_expires: { date: '2026-10-19' } }),
    ],
    licenses: null,
    consumables: null,
    maintenances: null,
  };
  const summary = summarize(data, { today: '2026-10-20', warrantyDays: 30, licenseDays: 30 });
  assert.deepEqual(
    summary.warranties.map((asset) => [asset.id, asset.daysLeft]),
    [
      [1, 0],
      [2, 30],
    ],
  );
  assert.equal(summary.licenses, null);
  assert.equal(summary.licenseCount, null);
  assert.equal(summary.consumablesLow, null);
  assert.equal(summary.maintenances, null);
});
