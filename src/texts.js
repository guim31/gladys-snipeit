// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js).
// -----------------------------------------------------------------------------

// Feature names (frozen by Gladys at creation).
export const NAMES = {
  en: {
    assets: 'Assets',
    checked_out: 'Checked-out assets',
    warranties: 'Warranties expiring soon',
    licenses: 'Licenses expiring soon',
    consumables: 'Consumables below minimum',
    audits: 'Overdue audits',
    checkins: 'Overdue check-ins',
    maintenances: 'Maintenances in progress',
    next_deadline: 'Next deadline',
  },
  fr: {
    assets: 'Matériels',
    checked_out: 'Matériels prêtés',
    warranties: 'Garanties bientôt expirées',
    licenses: 'Licences bientôt expirées',
    consumables: 'Consommables sous le seuil',
    audits: 'Audits en retard',
    checkins: 'Retours en retard',
    maintenances: 'Maintenances en cours',
    next_deadline: 'Prochaine échéance',
  },
  de: {
    assets: 'Assets',
    checked_out: 'Herausgegebene Assets',
    warranties: 'Bald ablaufende Garantien',
    licenses: 'Bald ablaufende Lizenzen',
    consumables: 'Verbrauchsmaterial unter Minimum',
    audits: 'Überfällige Audits',
    checkins: 'Überfällige Rückgaben',
    maintenances: 'Laufende Wartungen',
    next_deadline: 'Nächste Frist',
  },
  es: {
    assets: 'Activos',
    checked_out: 'Activos prestados',
    warranties: 'Garantías a punto de vencer',
    licenses: 'Licencias a punto de vencer',
    consumables: 'Consumibles bajo el mínimo',
    audits: 'Auditorías atrasadas',
    checkins: 'Devoluciones atrasadas',
    maintenances: 'Mantenimientos en curso',
    next_deadline: 'Próximo vencimiento',
  },
};

// The text feature and the scene action when there is nothing ahead.
export const NONE = { en: 'None', fr: 'Aucune', de: 'Keine', es: 'Ninguno' };

// What a deadline is about (widget badges, texts of the week).
export const KINDS = {
  en: {
    warranty: 'Warranty',
    license: 'License',
    checkin: 'Check-in',
    audit: 'Audit',
    maintenance: 'Maintenance',
  },
  fr: {
    warranty: 'Garantie',
    license: 'Licence',
    checkin: 'Retour',
    audit: 'Audit',
    maintenance: 'Maintenance',
  },
  de: {
    warranty: 'Garantie',
    license: 'Lizenz',
    checkin: 'Rückgabe',
    audit: 'Audit',
    maintenance: 'Wartung',
  },
  es: {
    warranty: 'Garantía',
    license: 'Licencia',
    checkin: 'Devolución',
    audit: 'Auditoría',
    maintenance: 'Mantenimiento',
  },
};

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
  de: 'Die Integration konnte nicht starten: sieh dir ihre Protokolle an.',
  es: 'La integración no pudo iniciarse: consulte sus registros.',
};

// The connection status shown in the Configuration screen.
export const STATUS_TEXT = {
  en: {
    none: 'Enter the address of Snipe-IT.',
    invalid: 'The Snipe-IT address is not valid (http or https, without user name in it).',
    token: 'Enter a Snipe-IT API token.',
    unreachable: 'Snipe-IT does not answer: check its address and that it is running.',
    unauthorized: 'Token refused: check the API token (it may have expired).',
    forbidden: 'The user of this token may not view the assets (permissions, or user deactivated).',
    invalid_answer: 'This address does not answer like Snipe-IT (a proxy login page?).',
  },
  fr: {
    none: "Saisissez l'adresse de Snipe-IT.",
    invalid:
      "L'adresse de Snipe-IT n'est pas valide (http ou https, sans nom d'utilisateur dedans).",
    token: "Saisissez un jeton d'API Snipe-IT.",
    unreachable: 'Snipe-IT ne répond pas : vérifiez son adresse et qu’il est démarré.',
    unauthorized: "Jeton refusé : vérifiez le jeton d'API (il a peut-être expiré).",
    forbidden:
      "L'utilisateur de ce jeton ne peut pas voir les matériels (droits, ou utilisateur désactivé).",
    invalid_answer: 'Cette adresse ne répond pas comme Snipe-IT (page de connexion d’un proxy ?).',
  },
  de: {
    none: 'Gib die Adresse von Snipe-IT ein.',
    invalid: 'Die Snipe-IT-Adresse ist ungültig (http oder https, ohne Benutzername darin).',
    token: 'Gib ein Snipe-IT-API-Token ein.',
    unreachable: 'Snipe-IT antwortet nicht: prüfe die Adresse und ob es läuft.',
    unauthorized: 'Token abgelehnt: prüfe das API-Token (es ist vielleicht abgelaufen).',
    forbidden:
      'Der Benutzer dieses Tokens darf die Assets nicht sehen (Rechte, oder Benutzer deaktiviert).',
    invalid_answer: 'Diese Adresse antwortet nicht wie Snipe-IT (Anmeldeseite eines Proxys?).',
  },
  es: {
    none: 'Introduzca la dirección de Snipe-IT.',
    invalid: 'La dirección de Snipe-IT no es válida (http o https, sin nombre de usuario).',
    token: 'Introduzca un token de API de Snipe-IT.',
    unreachable: 'Snipe-IT no responde: compruebe su dirección y que esté en marcha.',
    unauthorized: 'Token rechazado: compruebe el token de API (puede haber caducado).',
    forbidden:
      'El usuario de este token no puede ver los activos (permisos, o usuario desactivado).',
    invalid_answer: 'Esta dirección no responde como Snipe-IT (¿página de acceso de un proxy?).',
  },
};

// The "Test the connection" action.
// `licenses` is null when the token may not view them.
export const TEST_TEXT = {
  en: (version, assets, licenses) =>
    `Snipe-IT ${version} answers: ${assets} asset(s)` +
    (licenses === null ? '.' : `, ${licenses} license(s).`),
  fr: (version, assets, licenses) =>
    `Snipe-IT ${version} répond : ${assets} matériel(s)` +
    (licenses === null ? '.' : `, ${licenses} licence(s).`),
  de: (version, assets, licenses) =>
    `Snipe-IT ${version} antwortet. Assets: ${assets}` +
    (licenses === null ? '.' : `, Lizenzen: ${licenses}.`),
  es: (version, assets, licenses) =>
    `Snipe-IT ${version} responde: ${assets} activo(s)` +
    (licenses === null ? '.' : `, ${licenses} licencia(s).`),
};

// Errors of the scene action.
export const COMMAND_ERRORS = {
  en: { unreachable: 'Snipe-IT could not be read: see the status in the configuration.' },
  fr: { unreachable: "Snipe-IT n'a pas pu être lu : voyez l'état dans la configuration." },
  de: {
    unreachable:
      'Snipe-IT konnte nicht gelesen werden: sieh dir den Status in der Konfiguration an.',
  },
  es: { unreachable: 'No se pudo leer Snipe-IT: consulte el estado en la configuración.' },
};

/** { en, fr, de, es } of a coded command error. */
export function commandMessage(code) {
  return Object.fromEntries(
    Object.entries(COMMAND_ERRORS).map(([language, table]) => [language, table[code]]),
  );
}

// The relative day of a deadline (widget subtitles).
export const WHEN = {
  en: { today: 'Today', in: (n) => `In ${n} day(s)`, late: (n) => `${n} day(s) late` },
  fr: {
    today: "Aujourd'hui",
    in: (n) => `Dans ${n} jour(s)`,
    late: (n) => `${n} jour(s) de retard`,
  },
  de: { today: 'Heute', in: (n) => `In ${n} Tag(en)`, late: (n) => `${n} Tag(e) überfällig` },
  es: { today: 'Hoy', in: (n) => `En ${n} día(s)`, late: (n) => `${n} día(s) de retraso` },
};

export function when(daysLeft, language) {
  const table = WHEN[language] ?? WHEN.en;
  if (daysLeft === 0) {
    return table.today;
  }
  return daysLeft > 0 ? table.in(daysLeft) : table.late(-daysLeft);
}

// The spoken summary of the week (scene action), e.g. to send as a message.
export const WEEK_TEXT = {
  en: {
    none: 'No deadline in Snipe-IT this week.',
    intro: (n) => `${n} deadline(s) in Snipe-IT: `,
    more: (n) => ` and ${n} more`,
  },
  fr: {
    none: 'Aucune échéance dans Snipe-IT cette semaine.',
    intro: (n) => `${n} échéance(s) dans Snipe-IT : `,
    more: (n) => ` et ${n} autre(s)`,
  },
  de: {
    none: 'Keine Frist in Snipe-IT diese Woche.',
    intro: (n) => `Fristen in Snipe-IT (${n}): `,
    more: (n) => ` und ${n} weitere`,
  },
  es: {
    none: 'Ningún vencimiento en Snipe-IT esta semana.',
    intro: (n) => `${n} vencimiento(s) en Snipe-IT: `,
    more: (n) => ` y ${n} más`,
  },
};

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "2026-10-29" -> "29/10/2026" (fr), "29.10.2026" (de)... */
export function formatDay(day, language) {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/** "Warranty · MacBook Pro · 29/10/2026" */
export function describeDeadline(deadline, language) {
  const kinds = KINDS[language] ?? KINDS.en;
  return `${kinds[deadline.kind]} · ${deadline.name} · ${formatDay(deadline.day, language)}`;
}
