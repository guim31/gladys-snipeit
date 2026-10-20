# Snipe-IT for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for
[Snipe-IT](https://snipeitapp.com/), the open-source IT asset management
system: follow the warranties and licenses expiring, the checked-out assets
and those expected back, the consumables running low, the audits and the
maintenances, and react to them in scenes. Local only, read only.

Tested against a real Snipe-IT 8.8.1 server (official Docker image).

## Features

- **A Snipe-IT device**: assets, checked-out assets, warranties and licenses
  expiring within windows you set (30 days by default), consumables at or
  below their minimum, overdue audits, overdue check-ins, maintenances in
  progress, and the next deadline as a text.
- **Dashboard widget** "Snipe-IT deadlines": four tiles and the deadlines of
  the coming seven days, what is late first.
- **Scene triggers**: "Warranty expiring", "License expiring", "Consumable
  below minimum" and "Check-in overdue", once each, remembered across
  restarts.
- **Scene action** "Read the deadlines of the week": counts and a sentence
  ready to send as a message or to say.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1 or later.
- Snipe-IT reachable from Gladys (version 6 or later; tested on 8.8.1).
- A personal API token (Snipe-IT → your profile → Manage API keys) of a user
  who may at least view the assets. Licenses, consumables and maintenances are
  read when the user may view them.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-snipeit` (or find **Snipe-IT** in the
   catalog).
2. In **Configuration**, enter the address of Snipe-IT and the API token.
   Save, then **Test the connection**.
3. Add the **Snipe-IT** device from the **Discover** tab.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

Snipe-IT pushes nothing: the container reads it every hour by default (15
minutes to 6 hours) through its REST API (`/api/v1`): `hardware`, `licenses`,
`consumables` and `maintenances`, 500 rows per request. The device is
published with `should_poll: false`; only changed states are sent to Gladys,
with a heartbeat every 6 hours.

## Limitations

- Read only: nothing is ever written to Snipe-IT.
- One Snipe-IT server per integration; components and accessories are not
  followed.
- The triggers fire at the first read after the change; the first read after
  the installation announces nothing already pending.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake Snipe-IT answering
with bodies recorded on a real Snipe-IT 8.8.1 server
(`test/fixtures/snipeit/`, demo data).

## Credits

- [Snipe-IT](https://github.com/grokability/snipe-it), by Grokability and
  contributors (AGPL-3.0): this integration only talks to its REST API and
  contains none of its code.
- The cover shows the official Snipe-IT logo, taken from
  [snipeitapp.com](https://snipeitapp.com/img/logos/snipe-it-logo-xs.png).
  Snipe-IT and its logo are trademarks of Grokability, Inc.

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Grokability or
the Snipe-IT project.

## License

Apache-2.0, see [`LICENSE`](LICENSE).
