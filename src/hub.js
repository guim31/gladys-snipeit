// -----------------------------------------------------------------------------
// The hub: the link to one Snipe-IT and everything Gladys sees of it — the
// device, its states, the connection status, scene events, the week summary.
//
// Snipe-IT pushes nothing: the inventory is read every `refresh_minutes`
// (60 by default) by a timer of the container (should_poll: false, the
// interval being beyond the core's 60 s list). A read is four lists (assets,
// licenses, consumables, maintenances), 500 rows per request.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { buildDevice, buildStates, deviceIds, isOurDevice } from './devices.js';
import { SnipeItClient, SnipeItError } from './snipeit/client.js';
import {
  localDay,
  parseAsset,
  parseConsumable,
  parseLicense,
  parseMaintenance,
  summarize,
} from './snipeit/model.js';
import { MemoryStore } from './store.js';
import {
  KINDS,
  STATUS_TEXT,
  TEST_TEXT,
  WEEK_TEXT,
  commandMessage,
  formatDay,
  when,
} from './texts.js';

const logger = createLogger({ name: 'snipeit-hub' });

export const WIDGET_KEY = 'deadlines';
export const TRIGGERS = {
  warranty: 'warranty_expiring',
  license: 'license_expiring',
  consumable: 'consumable_low',
  checkin: 'checkin_overdue',
};

export const DEFAULT_TIMINGS = {
  // requestWidgetRefresh is dropped by the core beyond one call per 10 s.
  widgetGap: 10_500,
  // An unchanged value is sent again before Gladys calls it stale (48 h).
  heartbeat: 6 * 3_600_000,
  requestTimeout: 20_000,
};

// An import can bring hundreds of assets at once: past that many events in
// one read, the rest is recorded as announced without firing.
export const MAX_EVENTS_PER_READ = 10;
// Deadlines named in the text of the week summary.
export const WEEK_ITEMS = 6;

// The lists a token may be refused (their features then stay empty); the
// assets are required.
const OPTIONAL = ['licenses', 'consumables', 'maintenances'];

/** An Error carrying a coded, multi-language message. */
export class CommandError extends Error {
  constructor(code, language) {
    const messages = commandMessage(code);
    super(messages[language] ?? messages.en);
    this.code = code;
    this.messages = messages;
  }
}

export class Hub {
  constructor({ gladys, fetch, timings, now = Date.now, store }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.now = now;
    this.store = store ?? new MemoryStore();
    this.config = {
      url: null,
      urlInvalid: false,
      apiToken: '',
      warrantyDays: 30,
      licenseDays: 30,
      refreshMinutes: 60,
      language: 'fr',
    };
    this.client = null;
    this.version = null;
    /** the last read: { assets, licenses, consumables, maintenances (raw rows) } */
    this.data = null;
    this.summary = null;
    /** null (fine), or the kind of the last failure */
    this.failure = null;
    this.announced = false;
    /** the optional lists the token may not read, already logged */
    this.refused = new Set();
    this.lastStatus = '';
    /** what the triggers already announced: { instance, warranty: [], license: [], ... } */
    this.notified = null;
    this.configuring = Promise.resolve();
    this.refreshTimer = null;
    this.refreshing = null;
    this.refreshAgain = false;
    this.widgetRefreshAt = 0;
    this.widgetTimer = null;
    this.publishFailing = false;
    this.stopped = false;
  }

  get language() {
    return this.config.language;
  }

  get loaded() {
    return this.summary !== null;
  }

  async start(config) {
    const saved = await this.store.load();
    // A damaged file is a new baseline, not a crash on every read.
    this.notified = typeof saved.instance === 'string' ? saved : null;
    await this.reconfigure(config);
  }

  /** One configuration change at a time: a second one waits for the first. */
  reconfigure(config) {
    const run = this.configuring.then(() => this.#reconfigure(config));
    this.configuring = run.catch(() => {});
    return run;
  }

  async #reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const linkChanged =
      previous.url !== config.url || previous.apiToken !== config.apiToken || !this.client;
    if (linkChanged || previous.refreshMinutes !== config.refreshMinutes) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (linkChanged) {
      this.client = null;
      this.version = null;
      this.data = null;
      this.summary = null;
      this.failure = null;
      this.announced = false;
      this.refused.clear();
      if (config.url && config.apiToken) {
        this.client = new SnipeItClient({
          url: config.url,
          token: config.apiToken,
          fetch: this.fetch,
          timeout: this.timings.requestTimeout,
        });
      }
    }
    if (this.client && !this.refreshTimer) {
      this.refreshTimer = setInterval(
        () => this.refresh().catch((err) => logger.error('Read failed', err)),
        config.refreshMinutes * 60_000,
      );
      this.refreshTimer.unref?.();
    }
    if (linkChanged) {
      await this.refresh();
    } else {
      // Language or windows only: same data, new names, texts and counts.
      this.gladys.forgetPublishedStates?.();
      await this.#update();
    }
    await this.updateConnectionStatus();
  }

  /** Gladys reconnected (it may have restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.lastStatus = '';
    await this.reconfigure(config);
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.refreshTimer);
    clearTimeout(this.widgetTimer);
    this.refreshTimer = null;
    await this.store.flush();
  }

  // --- Reading Snipe-IT -----------------------------------------------------

  /** Read the inventory (one read at a time; a request during it runs once after). */
  refresh() {
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        try {
          await this.#refreshOnce();
        } catch (err) {
          // Never ends the loop: a read queued meanwhile (new address) still runs.
          logger.error('Read failed', err);
        }
      } while (this.refreshAgain && !this.stopped);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /** The version is only shown: an older Snipe-IT without it still works. */
  async #version(client) {
    try {
      const answer = await client.version();
      return String(answer?.version ?? '?').replace(/^v/, '');
    } catch (err) {
      if (err instanceof SnipeItError && ['forbidden', 'not_found'].includes(err.kind)) {
        return '?';
      }
      throw err;
    }
  }

  /** An optional list: null when the token may not read it (or it does not exist). */
  async #optional(client, name) {
    try {
      return await client[name]();
    } catch (err) {
      if (!(err instanceof SnipeItError && ['forbidden', 'not_found'].includes(err.kind))) {
        throw err;
      }
      if (!this.refused.has(name)) {
        this.refused.add(name);
        logger.warn(`Cannot read the ${name} (${err.message}): their counts stay empty`);
      }
      return null;
    }
  }

  async #refreshOnce() {
    const client = this.client;
    if (this.stopped) {
      return;
    }
    if (!client) {
      await this.publishDevices();
      return;
    }
    let data;
    try {
      if (!this.version) {
        this.version = await this.#version(client);
      }
      const [assets, licenses, consumables, maintenances] = await Promise.all([
        client.hardware(),
        ...OPTIONAL.map((name) => this.#optional(client, name)),
      ]);
      data = {
        assets: assets.map(parseAsset),
        licenses: licenses && licenses.map(parseLicense),
        consumables: consumables && consumables.map(parseConsumable),
        // Parsed on each update: whether an old-style maintenance is done
        // depends on the day.
        maintenances,
      };
    } catch (err) {
      if (client !== this.client) {
        return;
      }
      this.#fail(err);
      await this.updateConnectionStatus();
      return;
    }
    if (client !== this.client || this.stopped) {
      return;
    }
    this.data = data;
    this.#recover();
    await this.#update();
    if (client !== this.client || !this.summary) {
      // Reconfigured meanwhile: the read of the new link takes over.
      return;
    }
    await this.#announce(this.summary);
    await this.updateConnectionStatus();
  }

  /** Summary, device, states and widget from the last read. */
  async #update() {
    if (this.data) {
      const today = localDay(this.now());
      this.summary = summarize(
        {
          ...this.data,
          maintenances:
            this.data.maintenances &&
            this.data.maintenances.map((row) => parseMaintenance(row, today)),
        },
        {
          today,
          warrantyDays: this.config.warrantyDays,
          licenseDays: this.config.licenseDays,
        },
      );
    }
    await this.publishDevices();
    await this.publishStates();
    this.refreshWidget();
  }

  #fail(err) {
    const kind = err instanceof SnipeItError ? err.kind : 'unreachable';
    if (this.failure === null) {
      logger.warn(`Snipe-IT: ${err.message}`);
    } else {
      logger.debug(`Snipe-IT still failing: ${err.message}`);
    }
    this.failure = kind;
    if (kind === 'invalid' || kind === 'not_found') {
      this.version = null;
    }
  }

  #recover() {
    const count = this.data.assets.length;
    if (this.failure !== null) {
      logger.info(`Snipe-IT answers again (${count} assets)`);
    } else if (!this.announced) {
      logger.info(`Connected to Snipe-IT ${this.version} (${count} assets)`);
    }
    this.announced = true;
    this.failure = null;
  }

  // --- Scene events ---------------------------------------------------------

  /**
   * Fire what entered its window since the last read: a warranty or a license
   * expiring, a consumable at or below its minimum, a check-in now overdue.
   * The first read of a Snipe-IT (or of a list) is a silent baseline:
   * installing the integration announces nothing already pending. A
   * consumable is announced again once it went back above its minimum.
   */
  async #announce(summary) {
    const current = {
      warranty: summary.warranties.map((asset) => [
        `${asset.id}|${asset.warranty}`,
        () => this.#warrantyEvent(asset),
      ]),
      license:
        summary.licenses &&
        summary.licenses.map((license) => [
          `${license.id}|${license.expires}`,
          () => this.#licenseEvent(license),
        ]),
      consumable:
        summary.consumablesLow &&
        summary.consumablesLow.map((item) => [String(item.id), () => this.#consumableEvent(item)]),
      checkin: summary.checkinsOverdue.map((asset) => [
        `${asset.id}|${asset.expectedCheckin}`,
        () => this.#checkinEvent(asset),
      ]),
    };
    const instance = this.config.url;
    const known = this.notified?.instance === instance ? this.notified : null;
    const events = [];
    for (const [kind, entries] of Object.entries(current)) {
      const done = known?.[kind];
      if (entries && Array.isArray(done)) {
        for (const [key, event] of entries) {
          if (!done.includes(key)) {
            events.push([kind, key, event]);
          }
        }
      }
    }
    if (events.length > MAX_EVENTS_PER_READ) {
      logger.info(`${events.length} deadlines at once: ${MAX_EVENTS_PER_READ} announced`);
    }
    // An event Gladys did not take (disconnected, restarting) is not
    // recorded: the next read fires it again.
    const failed = new Set();
    for (const [kind, key, event] of events.slice(0, MAX_EVENTS_PER_READ)) {
      const [trigger, data] = event();
      try {
        await this.gladys.publishSceneEvent(trigger, data);
      } catch (err) {
        failed.add(`${kind}:${key}`);
        logger.warn(`Cannot fire ${trigger}: ${err.message}`);
      }
    }
    const next = { instance };
    for (const [kind, entries] of Object.entries(current)) {
      next[kind] = entries
        ? entries
            .map(([key]) => key)
            .filter((key) => !failed.has(`${kind}:${key}`))
            .sort()
        : // A list the token may not read keeps what was announced before.
          (known?.[kind] ?? null);
    }
    if (JSON.stringify(next) !== JSON.stringify(this.notified)) {
      this.notified = next;
      await this.store.save(next);
    }
  }

  #warrantyEvent(asset) {
    logger.debug(`Warranty of asset ${asset.id} ends in ${asset.daysLeft} day(s)`);
    return [
      TRIGGERS.warranty,
      {
        asset: asset.name,
        asset_tag: asset.tag,
        model: asset.model,
        expires: formatDay(asset.warranty, this.language),
        days_left: asset.daysLeft,
      },
    ];
  }

  #licenseEvent(license) {
    logger.debug(`License ${license.id} expires in ${license.daysLeft} day(s)`);
    return [
      TRIGGERS.license,
      {
        license: license.name,
        seats: license.seats,
        expires: formatDay(license.expires, this.language),
        days_left: license.daysLeft,
      },
    ];
  }

  #consumableEvent(item) {
    logger.debug(`Consumable ${item.id} at ${item.remaining} (minimum ${item.minimum})`);
    return [
      TRIGGERS.consumable,
      { consumable: item.name, remaining: item.remaining, minimum: item.minimum },
    ];
  }

  #checkinEvent(asset) {
    logger.debug(`Check-in of asset ${asset.id} overdue`);
    return [
      TRIGGERS.checkin,
      {
        asset: asset.name,
        asset_tag: asset.tag,
        assigned_to: asset.assignedTo,
        expected: formatDay(asset.expectedCheckin, this.language),
        days_late: -asset.daysLeft,
      },
    ];
  }

  // --- Device and states ----------------------------------------------------

  #isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  buildDevices() {
    if (!this.summary) {
      return [];
    }
    return [buildDevice(this.gladys, this.language, this.config.url ?? '', this.version)];
  }

  async publishDevices() {
    if (this.stopped) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(this.buildDevices());
    } catch (err) {
      logger.error('Cannot publish the devices', err);
    }
  }

  /**
   * The states of the device, once the user added it (Gladys drops the others).
   * @param {boolean} [force] the device was just created
   */
  async publishStates(force = false) {
    if (!this.summary || this.stopped) {
      return;
    }
    if (!force && !this.#isCreated(deviceIds(this.gladys).device)) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(
        buildStates(this.gladys, this.summary, this.language),
        {
          heartbeat: this.timings.heartbeat,
        },
      );
    } catch (err) {
      if (this.publishFailing) {
        logger.debug(`Cannot publish the states: ${err.message}`);
      } else {
        logger.warn(`Cannot publish the states: ${err.message}`);
      }
      this.publishFailing = true;
      return;
    }
    if (this.publishFailing) {
      logger.info('States published again');
    }
    this.publishFailing = false;
  }

  /** The user added the device: states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    if (!isOurDevice(this.gladys, device?.external_id)) {
      return;
    }
    this.gladys.forgetPublishedStates?.(device.external_id);
    await this.publishStates(true);
    this.refreshWidget();
  }

  /** onPoll (the device is not polled: the container reads on its timer). */
  async poll(device) {
    if (isOurDevice(this.gladys, device?.external_id)) {
      await this.publishStates(true);
    }
  }

  // --- Widget ---------------------------------------------------------------

  /** Nudge the open dashboards, with a trailing call inside the core's 10 s gap. */
  refreshWidget() {
    if (this.stopped) {
      return;
    }
    const wait = this.widgetRefreshAt + this.timings.widgetGap - this.now();
    if (wait <= 0) {
      this.widgetRefreshAt = this.now();
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
      return;
    }
    if (!this.widgetTimer) {
      this.widgetTimer = setTimeout(() => {
        this.widgetTimer = null;
        this.refreshWidget();
      }, wait);
      this.widgetTimer.unref?.();
    }
  }

  // --- Connection status ----------------------------------------------------

  statusKey() {
    if (this.config.urlInvalid) {
      return 'invalid';
    }
    if (!this.config.url) {
      return 'none';
    }
    if (!this.config.apiToken) {
      return 'token';
    }
    if (this.failure) {
      return (
        {
          unauthorized: 'unauthorized',
          forbidden: 'forbidden',
          invalid: 'invalid_answer',
          not_found: 'invalid_answer',
        }[this.failure] ?? 'unreachable'
      );
    }
    return null;
  }

  statusMessage() {
    const key = this.statusKey();
    if (!key) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(STATUS_TEXT).map(([language, table]) => [language, table[key]]),
    );
  }

  async updateConnectionStatus() {
    if (this.stopped) {
      return;
    }
    // Nothing to say before the first answer or failure.
    if (this.client && !this.loaded && this.failure === null) {
      return;
    }
    const message = this.statusMessage();
    const connected = Boolean(this.client) && this.loaded && this.failure === null;
    const fingerprint = JSON.stringify({ connected, message });
    if (fingerprint === this.lastStatus) {
      return;
    }
    this.lastStatus = fingerprint;
    try {
      await this.gladys.setConnectionStatus(connected, message ?? undefined);
    } catch (err) {
      logger.warn(`Cannot set the connection status: ${err.message}`);
    }
  }

  // --- Actions --------------------------------------------------------------

  /** "Test the connection": a fresh read, then its outcome. */
  async testReport() {
    if (!this.client) {
      return this.statusMessage();
    }
    await this.refresh();
    const message = this.statusMessage();
    if (message) {
      return message;
    }
    const { assets, licenseCount } = this.summary;
    return Object.fromEntries(
      Object.entries(TEST_TEXT).map(([language, render]) => [
        language,
        render(this.version, assets, licenseCount ?? 0),
      ]),
    );
  }

  /**
   * The scene action: the deadlines of the coming seven days and what is
   * late, as counts and a sentence to send. Reads Snipe-IT first.
   */
  async readWeek() {
    if (this.client) {
      await this.refresh();
    }
    if (!this.client || this.failure !== null || !this.summary) {
      throw new CommandError('unreachable', this.language);
    }
    const deadlines = this.summary.deadlines;
    logger.info(`Week summary: ${deadlines.length} deadline(s)`);
    return {
      count: deadlines.length,
      late: deadlines.filter((deadline) => deadline.daysLeft < 0).length,
      text: weekText(deadlines, this.language),
    };
  }
}

/** "3 deadline(s) in Snipe-IT: License Antivirus 22/10/2026; ..." */
export function weekText(deadlines, language) {
  const texts = WEEK_TEXT[language] ?? WEEK_TEXT.en;
  if (deadlines.length === 0) {
    return texts.none;
  }
  const kinds = KINDS[language] ?? KINDS.en;
  const parts = deadlines.slice(0, WEEK_ITEMS).map((deadline) => {
    const date =
      deadline.daysLeft < 0 ? when(deadline.daysLeft, language) : formatDay(deadline.day, language);
    return `${kinds[deadline.kind]} ${deadline.name} (${date})`;
  });
  const more = deadlines.length - WEEK_ITEMS;
  return `${texts.intro(deadlines.length)}${parts.join(', ')}${more > 0 ? texts.more(more) : ''}.`;
}
