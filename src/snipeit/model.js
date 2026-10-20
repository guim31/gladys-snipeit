// -----------------------------------------------------------------------------
// Snipe-IT rows -> the few facts Gladys needs, then the summary of the
// inventory on a given day: counts, the deadlines in their windows, the
// deadlines of the coming week.
//
// Days are local calendar days ("2026-10-17"): Snipe-IT stores dates without
// time zone, and Gladys gives the container its own zone (TZ).
// -----------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

// The week of the scene action and of the widget list.
export const WEEK_DAYS = 7;

/** A Snipe-IT date (`"2026-10-17"`, `"2026-10-17 10:00:00"` or `{ date }`) -> day or null. */
export function dayOf(value) {
  const raw = value && typeof value === 'object' ? (value.date ?? value.datetime) : value;
  if (typeof raw !== 'string') {
    return null;
  }
  const match = raw.match(DAY);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** The local day of a timestamp. */
export function localDay(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to` (both days), negative when `to` is past. */
export function daysBetween(from, to) {
  const utc = (day) => Date.UTC(...day.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

// Snipe-IT escapes the texts of its API for HTML output.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#039': "'", '#39': "'", apos: "'" };
export function plain(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/&(amp|lt|gt|quot|#0?39|apos);/g, (_, name) => ENTITIES[name]).trim();
}

const number = (value) => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** One hardware row -> what the integration uses. */
export function parseAsset(row) {
  const tag = plain(row.asset_tag);
  const model = plain(row.model?.name);
  const meta = row.status_label?.status_meta ?? row.status_label?.status_type ?? '';
  return {
    id: row.id,
    name: plain(row.name) || model || tag || `#${row.id}`,
    tag,
    model,
    archived: meta === 'archived',
    assignedTo: row.assigned_to ? plain(row.assigned_to.name) || '?' : '',
    warranty: dayOf(row.warranty_expires),
    audit: dayOf(row.next_audit_date),
    expectedCheckin: dayOf(row.expected_checkin),
  };
}

export function parseLicense(row) {
  return {
    id: row.id,
    name: plain(row.name) || `#${row.id}`,
    expires: dayOf(row.expiration_date),
    seats: number(row.seats) ?? 0,
  };
}

export function parseConsumable(row) {
  return {
    id: row.id,
    name: plain(row.name) || `#${row.id}`,
    remaining: number(row.remaining) ?? number(row.qty) ?? 0,
    minimum: number(row.min_amt) ?? 0,
  };
}

/**
 * A maintenance, across Snipe-IT versions:
 * - v8.6+ has `completed_at` (the actual completion) and the planned end in
 *   `expected_completion_date` (v8.7+) or `completion_date` (v8.6);
 * - older versions only have `completion_date`, the day it was completed.
 */
export function parseMaintenance(row, today) {
  const modern = 'completed_at' in row;
  const completion = dayOf(row.completion_date);
  let done;
  let end;
  if (modern) {
    done = Boolean(row.completed_at);
    end = dayOf(row.expected_completion_date) ?? completion;
  } else {
    // A completion day still ahead can only be a plan.
    done = completion !== null && completion <= today;
    end = completion;
  }
  return {
    id: row.id,
    title: plain(row.name ?? row.title) || `#${row.id}`,
    asset: plain(row.asset?.name) || plain(row.asset?.asset_tag) || '',
    start: dayOf(row.start_date),
    end,
    done,
  };
}

const byDay = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : a.id - b.id);

/** A consumable is low at or under its minimum (Snipe-IT's own low-stock rule). */
export const isLow = (consumable) =>
  consumable.minimum > 0 && consumable.remaining <= consumable.minimum;

/**
 * @param {{ assets: object[], licenses: object[] | null, consumables: object[] | null, maintenances: object[] | null }} data
 *   parsed lists; null when the token may not read that list
 * @param {{ today: string, warrantyDays: number, licenseDays: number }} options
 */
export function summarize(data, { today, warrantyDays, licenseDays }) {
  const left = (day) => daysBetween(today, day);
  const active = data.assets.filter((asset) => !asset.archived);
  const within = (day, days) => day !== null && left(day) >= 0 && left(day) <= days;

  const warranties = active
    .filter((asset) => within(asset.warranty, warrantyDays))
    .sort(byDay('warranty'))
    .map((asset) => ({ ...asset, daysLeft: left(asset.warranty) }));
  const licenses =
    data.licenses &&
    data.licenses
      .filter((license) => within(license.expires, licenseDays))
      .sort(byDay('expires'))
      .map((license) => ({ ...license, daysLeft: left(license.expires) }));
  const consumablesLow =
    data.consumables &&
    data.consumables.filter(isLow).sort((a, b) => a.remaining - b.remaining || a.id - b.id);
  const auditsOverdue = active
    .filter((asset) => asset.audit !== null && left(asset.audit) < 0)
    .sort(byDay('audit'))
    .map((asset) => ({ ...asset, daysLeft: left(asset.audit) }));
  const checkins = active
    .filter((asset) => asset.assignedTo && asset.expectedCheckin !== null)
    .sort(byDay('expectedCheckin'))
    .map((asset) => ({ ...asset, daysLeft: left(asset.expectedCheckin) }));
  const checkinsOverdue = checkins.filter((asset) => asset.daysLeft < 0);
  // In progress: started, and not completed yet.
  const maintenances =
    data.maintenances &&
    data.maintenances
      .filter((m) => !m.done && m.start !== null && left(m.start) <= 0)
      .sort(byDay('start'));

  // The deadlines of the coming week and what is already late (a check-in, an
  // audit, a maintenance), the latest first.
  const deadlines = [
    ...warranties
      .filter((a) => a.daysLeft <= WEEK_DAYS)
      .map((a) => ({ kind: 'warranty', day: a.warranty, daysLeft: a.daysLeft, name: a.name })),
    ...(licenses ?? [])
      .filter((l) => l.daysLeft <= WEEK_DAYS)
      .map((l) => ({ kind: 'license', day: l.expires, daysLeft: l.daysLeft, name: l.name })),
    ...checkins
      .filter((a) => a.daysLeft <= WEEK_DAYS)
      .map((a) => ({
        kind: 'checkin',
        day: a.expectedCheckin,
        daysLeft: a.daysLeft,
        name: a.name,
        who: a.assignedTo,
      })),
    ...active
      .filter((a) => a.audit !== null && left(a.audit) <= WEEK_DAYS)
      .map((a) => ({ kind: 'audit', day: a.audit, daysLeft: left(a.audit), name: a.name })),
    ...(data.maintenances ?? [])
      .filter((m) => !m.done && m.end !== null && left(m.end) <= WEEK_DAYS)
      .map((m) => ({
        kind: 'maintenance',
        day: m.end,
        daysLeft: left(m.end),
        name: m.asset ? `${m.title} · ${m.asset}` : m.title,
      })),
  ].sort((a, b) => a.daysLeft - b.daysLeft || a.kind.localeCompare(b.kind));

  return {
    assets: data.assets.length,
    checkedOut: active.filter((asset) => asset.assignedTo).length,
    licenseCount: data.licenses?.length ?? null,
    warranties,
    licenses,
    consumablesLow,
    auditsOverdue,
    checkinsOverdue,
    maintenances,
    deadlines,
  };
}
