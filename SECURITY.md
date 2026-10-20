# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration holds: the Snipe-IT address and a personal API token, kept
by Gladys in the integration configuration (never logged, never written to
`/data`). `/data` holds a small JSON file listing the deadlines already
announced by the scene triggers (Snipe-IT ids and dates) and the address of the
Snipe-IT server they belong to. The container only talks to the Snipe-IT
address, over HTTP or HTTPS, and only reads: it never writes to Snipe-IT. Use a
token of a user who may only view, and HTTPS when Snipe-IT is not on your local
network.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Snipe-IT itself (see the
[Snipe-IT security policy](https://github.com/grokability/snipe-it/security/policy)).
