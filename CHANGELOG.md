# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- A Snipe-IT device: assets, checked-out assets, warranties and licenses
  expiring soon (windows you set), consumables at or below their minimum,
  overdue audits and check-ins, maintenances in progress, and the next deadline
  as a text.
- The "Snipe-IT deadlines" dashboard widget: four tiles and the deadlines of the
  week, what is late first.
- Scene triggers "Warranty expiring", "License expiring", "Consumable below
  minimum" and "Check-in overdue", announced once, remembered across restarts.
- Scene action "Read the deadlines of the week": counts and a sentence ready to
  send.
- A token that may only view the assets still works: the other counts stay
  empty.
- Texts and documentation in English, French, German and Spanish.
