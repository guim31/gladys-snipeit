# Snipe-IT

Follow your [Snipe-IT](https://snipeitapp.com/) inventory in Gladys: the
warranties and licenses expiring soon, the assets checked out and those
expected back, the consumables running low, the audits and maintenances.
Everything stays on your local network: Gladys talks directly to your
Snipe-IT server, and only reads it.

Tested against a real Snipe-IT 8.8.1 server (the official Docker image).
Feedback welcome on the Gladys forum.

## Prerequisites

- Gladys Assistant 5.1 or later.
- A Snipe-IT server (version 6 or later) reachable from the Gladys machine.
- A personal API token: in Snipe-IT, open your profile menu (top right),
  **Manage API keys**, then **Create new token**, and copy it at once (it is
  shown only once). The user of the token needs at least to view the assets;
  licenses, consumables and maintenances are read when the user may view them.

## Configuration

1. Open the **Configuration** tab of the integration.
2. In **Snipe-IT address**, enter the address you open in your browser, for
   example `http://192.168.1.50` or `https://snipeit.example.org`.
3. Paste the **API token**.
4. **Warranty expiring within (days)**: a warranty counts as expiring soon
   this many days before its end (30 by default).
5. **License expiring within (days)**: the same for licenses (30 by default).
6. **Read Snipe-IT every**: 15 minutes, 30 minutes, 1 hour (default), 3 or 6
   hours.
7. **Language of names and messages** sets the feature names (fixed when the
   device is added), the texts and the dates of the scene variables. French by
   default.
8. Save, then use **Test the connection**: it shows the Snipe-IT version and
   the number of assets and licenses.
9. In the **Discovery** tab, add the **Snipe-IT** device.

## Devices

**Snipe-IT** (one device for your inventory):

| Feature                   | Value                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| Assets                    | number of assets (Snipe-IT leaves the archived ones out)         |
| Checked-out assets        | assets checked out to a user, a location or another asset        |
| Warranties expiring soon  | assets whose warranty ends within the configured window          |
| Licenses expiring soon    | licenses whose expiration date is within the configured window   |
| Consumables below minimum | consumables at or below their minimum quantity (minimum above 0) |
| Overdue audits            | assets whose next audit date has passed                          |
| Overdue check-ins         | checked-out assets whose expected check-in date has passed       |
| Maintenances in progress  | maintenances started and not completed                           |
| Next deadline             | kind, name and date of the next deadline of the week, or "None"  |

Warranties and licenses already expired are not counted. When the token may
not view the licenses or the consumables, their features stay without value.

## Dashboard widget

**Snipe-IT deadlines**: four tiles (assets, checked out, warranties and
licenses expiring, consumables low) and the deadlines of the coming seven
days, what is late first (red). Without the right to view the consumables,
the low-stock tile is left out: expected check-ins, audits, planned ends of
maintenances, warranties and licenses ending. Read only.

## Scene triggers

- **Warranty expiring**: the warranty of an asset enters the configured
  window. Once per asset and end date. Variables: asset, asset tag, model, end
  date, days left.
- **License expiring**: a license enters the configured window. Once per
  license and date. Variables: license, seats, expiration date, days left.
- **Consumable below minimum**: a consumable falls to or below its minimum
  quantity. Announced again once restocked above it. Variables: consumable,
  remaining, minimum.
- **Check-in overdue**: a checked-out asset passes its expected check-in date.
  Once per loan. Variables: asset, asset tag, checked out to, expected
  check-in, days late.

The first read after the installation is silent: what is already pending is
shown on the device, not announced. The triggers fire at the first read after
the change (after midnight, within the configured interval).

## Scene actions

**Read the deadlines of the week**: reads Snipe-IT and returns **Deadlines**
(the number of deadlines of the coming seven days and of what is late),
**Late**, and **Summary text**, a sentence ready to send or to say, for
example "3 deadline(s) in Snipe-IT: Check-in Laptop Bob (2 day(s) late),
License Antivirus (22/10/2026), Warranty Home server (25/10/2026)."

## Scene examples

- **Monday digest**: every Monday at 9:00 → "Read the deadlines of the week" →
  continue only if the number of deadlines is above 0 → send the summary text
  as a message.
- **Loan reminder**: trigger "Check-in overdue" → message
  "{{triggerEvent.data.asset}} should have been back from
  {{triggerEvent.data.assigned_to}} on {{triggerEvent.data.expected}}".
- **Shopping list**: trigger "Consumable below minimum" → message "Only
  {{triggerEvent.data.remaining}} {{triggerEvent.data.consumable}} left".

## Troubleshooting

- **"Token refused"**: the token was revoked, has expired or was not pasted
  whole. Create a new one.
- **"The user of this token may not view the assets"**: give the user the
  "View" permission on assets in Snipe-IT, and check that the user is
  activated.
- **"Snipe-IT does not answer"**: check the address from the Gladys machine.
  The container uses a bridge network: `localhost` is the container itself,
  enter the IP address of the server instead.
- **"This address does not answer like Snipe-IT"**: a proxy login page answers
  instead, or the address is not the one of Snipe-IT (check the `APP_URL` and
  the path behind a reverse proxy).
- To see more in the logs of the integration, set `LOG_LEVEL=debug`.

## Limits

- Read only: the integration never changes your inventory.
- Each read is at least four requests (assets, licenses, consumables,
  maintenances, 500 rows per request), far below the Snipe-IT API limit (120
  requests per minute by default).
- One Snipe-IT server per integration. Components and accessories are not
  followed.
- Not affiliated with Grokability or the Snipe-IT project.
