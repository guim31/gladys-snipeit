// -----------------------------------------------------------------------------
// The Snipe-IT inventory -> one Gladys device (`snipeit:server`): counts of
// assets, checked-out assets, warranties and licenses expiring soon,
// consumables below their minimum, overdue audits and check-ins, maintenances
// in progress, and the next deadline as a text.
//
// Snipe-IT has no instance id an API token can read: the device id is fixed,
// so a new address (a new IP, a reverse proxy) keeps the same device, its
// history and its scenes. One integration talks to one Snipe-IT.
// Everything is read only: the integration never writes to Snipe-IT.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CAT,
  DEVICE_FEATURE_TYPES as TYPE,
} from '@gladysassistant/integration-sdk';
import { NAMES, NONE, describeDeadline } from './texts.js';

export const DEVICE_TYPE = 'snipeit';
export const DEVICE_ID = 'server';

const MAX_COUNT = 1_000_000;

export const deviceIds = (gladys) => gladys.externalIds(DEVICE_TYPE, DEVICE_ID);

// Feature key -> [name key, summary -> count, or null when the token may not
// read that list].
export const COUNTS = {
  assets: ['assets', (s) => s.assets],
  checked_out: ['checked_out', (s) => s.checkedOut],
  warranties_expiring: ['warranties', (s) => s.warranties.length],
  licenses_expiring: ['licenses', (s) => s.licenses?.length ?? null],
  consumables_low: ['consumables', (s) => s.consumablesLow?.length ?? null],
  audits_overdue: ['audits', (s) => s.auditsOverdue.length],
  checkins_overdue: ['checkins', (s) => s.checkinsOverdue.length],
  maintenances_in_progress: ['maintenances', (s) => s.maintenances?.length ?? null],
};

/**
 * @param {object} gladys
 * @param {string} language
 * @param {string} url Snipe-IT base URL (a device param, shown in Gladys)
 * @param {string} version
 */
export function buildDevice(gladys, language, url, version) {
  const names = NAMES[language] ?? NAMES.en;
  const ids = deviceIds(gladys);
  const feature = (key, name, fields) => ({
    name,
    external_id: ids.feature(key),
    read_only: true,
    has_feedback: false,
    ...fields,
  });
  return {
    name: 'Snipe-IT',
    external_id: ids.device,
    model: version ? `Snipe-IT ${version}`.slice(0, 60) : 'Snipe-IT',
    should_poll: false,
    features: [
      ...Object.entries(COUNTS).map(([key, [nameKey]]) =>
        feature(key, names[nameKey], {
          category: CAT.COUNTER_SENSOR,
          type: TYPE.SENSOR.INTEGER,
          min: 0,
          max: MAX_COUNT,
          keep_history: true,
        }),
      ),
      feature('next_deadline', names.next_deadline, {
        category: CAT.TEXT,
        type: TYPE.TEXT.TEXT,
        min: 0,
        max: 0,
        keep_history: false,
      }),
    ],
    params: [{ name: 'SNIPEIT_URL', value: url }],
  };
}

export function buildStates(gladys, summary, language) {
  const ids = deviceIds(gladys);
  const states = [];
  for (const [key, [, count]] of Object.entries(COUNTS)) {
    const value = count(summary);
    if (value !== null) {
      states.push({ device_feature_external_id: ids.feature(key), state: value });
    }
  }
  // The next deadline still ahead (what is late is in the counts).
  const next = summary.deadlines.find((deadline) => deadline.daysLeft >= 0);
  states.push({
    device_feature_external_id: ids.feature('next_deadline'),
    text: (next ? describeDeadline(next, language) : (NONE[language] ?? NONE.en)).slice(0, 200),
  });
  return states;
}

export const isOurDevice = (gladys, externalId) => externalId === deviceIds(gladys).device;
