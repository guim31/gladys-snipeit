// -----------------------------------------------------------------------------
// The "Snipe-IT deadlines" dashboard widget: tiles (assets, checked out,
// expiring, consumables low when readable) and the list of the
// deadlines of the week — what is late first, then the soonest.
// Read only: no button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './hub.js';
import { KINDS, formatDay, when } from './texts.js';

export const MAX_ITEMS = 8;

export const TEXT = {
  assets: { en: 'Assets', fr: 'Matériels', de: 'Assets', es: 'Activos' },
  checked_out: { en: 'Checked out', fr: 'Prêtés', de: 'Herausgegeben', es: 'Prestados' },
  expiring: { en: 'Expiring', fr: 'Expirent', de: 'Laufen ab', es: 'Vencen' },
  low: { en: 'Low stock', fr: 'Stock bas', de: 'Knapp', es: 'Stock bajo' },
  nothing: {
    en: 'No deadline this week.',
    fr: 'Aucune échéance cette semaine.',
    de: 'Keine Frist diese Woche.',
    es: 'Ningún vencimiento esta semana.',
  },
  waiting: {
    en: 'Waiting for Snipe-IT: check the configuration of the integration.',
    fr: "En attente de Snipe-IT : vérifiez la configuration de l'intégration.",
    de: 'Warte auf Snipe-IT: prüfe die Konfiguration der Integration.',
    es: 'Esperando a Snipe-IT: compruebe la configuración de la integración.',
  },
};

const BADGE_COLORS = {
  warranty: WIDGET_COLORS.INFO,
  license: WIDGET_COLORS.INFO,
  checkin: WIDGET_COLORS.WARNING,
  audit: WIDGET_COLORS.WARNING,
  maintenance: WIDGET_COLORS.WARNING,
};

const pick = (table, language) => table[language] ?? table.en;
const cut = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** The card-list rows of the deadlines. */
export function deadlineItems(deadlines, language) {
  const kinds = KINDS[language] ?? KINDS.en;
  return deadlines.slice(0, MAX_ITEMS).map((deadline) => ({
    title: cut(deadline.who ? `${deadline.name} · ${deadline.who}` : deadline.name, 60),
    subtitle: `${when(deadline.daysLeft, language)} · ${formatDay(deadline.day, language)}`,
    badge: {
      text: cut(kinds[deadline.kind], 16),
      color: deadline.daysLeft < 0 ? WIDGET_COLORS.DANGER : BADGE_COLORS[deadline.kind],
    },
  }));
}

export function buildContent(hub, { language = 'en' } = {}) {
  const summary = hub.summary;
  if (!summary) {
    return {
      ttl_seconds: 60,
      components: [{ type: 'text', variant: 'body', text: pick(TEXT.waiting, language) }],
    };
  }
  const expiring = summary.warranties.length + (summary.licenses?.length ?? 0);
  const low = summary.consumablesLow?.length;
  return {
    // The hub nudges the widget after every read.
    ttl_seconds: 900,
    components: [
      { type: 'value', label: pick(TEXT.assets, language), value: summary.assets, icon: 'box' },
      {
        type: 'value',
        label: pick(TEXT.checked_out, language),
        value: summary.checkedOut,
        icon: 'user-check',
      },
      {
        type: 'value',
        label: pick(TEXT.expiring, language),
        value: expiring,
        icon: 'shield',
        color: expiring > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
      },
      // A token that may not view the consumables: no tile rather than a false 0.
      ...(summary.consumablesLow
        ? [
            {
              type: 'value',
              label: pick(TEXT.low, language),
              value: low,
              icon: 'package',
              color: low > 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
            },
          ]
        : []),
      summary.deadlines.length > 0
        ? {
            type: 'card-list',
            display: 'list',
            items: deadlineItems(summary.deadlines, language),
          }
        : { type: 'text', variant: 'caption', text: pick(TEXT.nothing, language) },
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (hub, request) => buildContent(hub, request),
  },
};
