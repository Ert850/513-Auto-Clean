/**
 * Line icons for the add-ons.
 *
 * Every add-on used to render the same clock glyph, which told a customer
 * nothing and made the list read as fifteen copies of one thing. These are
 * drawn to be recognisable at about 19px: a paw, a wheel, a spray bottle, a
 * gem, and so on.
 *
 * Stored as the INNER markup of a 24x24 viewBox, stroked in currentColor by
 * the wrapper. Both the front page renderer and the booking funnel pull from
 * here, so an icon cannot appear in one and not the other.
 */
export const ADDON_ICONS: Record<string, string> = {
  /** Paw print. */
  paw:
    '<circle cx="6.8" cy="9.5" r="1.9"/><circle cx="11.4" cy="6.8" r="1.9"/>' +
    '<circle cx="16.6" cy="9" r="1.9"/>' +
    '<path d="M7.2 16.6c0-2.5 2.2-4.3 4.7-4.3s4.7 1.8 4.7 4.3c0 2-1.6 3.4-3.4 3.4-.9 0-1.1-.4-1.3-.4s-.4.4-1.3.4c-1.8 0-3.4-1.4-3.4-3.4z"/>',

  /** A droplet on a surface: a stain being lifted. */
  droplet:
    '<path d="M12 3.4c3 3.7 4.6 6.3 4.6 8.4a4.6 4.6 0 1 1-9.2 0c0-2.1 1.6-4.7 4.6-8.4z"/>' +
    '<path d="M4 20.5h16"/>',

  /** Vapour rising off a surface. */
  steam:
    '<path d="M4 20.5h16"/>' +
    '<path d="M8 17c0-2 2-2.6 2-4.6S8 9.4 8 7.4"/>' +
    '<path d="M12 17c0-2 2-2.6 2-4.6S12 9.4 12 7.4"/>' +
    '<path d="M16 17c0-2 2-2.6 2-4.6"/>',

  /** Three bonded atoms: O3. */
  molecule:
    '<circle cx="6.6" cy="15.2" r="3"/><circle cx="17.4" cy="15.2" r="3"/>' +
    '<circle cx="12" cy="6.6" r="3"/>' +
    '<path d="M9.4 13.1 10.6 10.7"/><path d="M14.6 13.1 13.4 10.7"/>' +
    '<path d="M9.6 15.2h4.8"/>',

  /** A car seat, back and base. */
  seat:
    '<path d="M8.5 3.5h3.5a2 2 0 0 1 2 2v7.5H8.5a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2z"/>' +
    '<path d="M6.5 13h9.5a3 3 0 0 1 3 3v1.5H9.5a3 3 0 0 1-3-3z"/>' +
    '<path d="M8.5 17.5v3"/><path d="M17.5 17.5v3"/>',

  /** A headlight housing throwing beams. */
  headlight:
    '<path d="M4 6.5h4.5a7 7 0 0 1 0 11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>' +
    '<path d="M15 8.5h5"/><path d="M15.5 12H21"/><path d="M15 15.5h5"/>',

  /** A wheel with spokes. */
  wheel:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>' +
    '<path d="M12 3.5v5.5"/><path d="M12 15v5.5"/>' +
    '<path d="M3.5 12H9"/><path d="M15 12h5.5"/>',

  /** A spray bottle with mist. */
  spray:
    '<path d="M9 9.5h5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2z"/>' +
    '<path d="M10 9.5V6h4"/><path d="M14 6l3.2-1.4"/>' +
    '<path d="M19.5 7.2 21 6.7"/><path d="M19.2 10.2l1.6.3"/><path d="M19.8 3.6 21 3"/>',

  /** A clay block moving across a panel. */
  bar:
    '<rect x="7" y="9" width="12" height="6.5" rx="2.5"/>' +
    '<path d="M2.5 9h2.5"/><path d="M1.5 12.2h3.5"/><path d="M2.5 15.5h2.5"/>',

  /** Water spots, struck through. */
  spots:
    '<path d="M8.2 4.6c1.9 2.3 2.9 4 2.9 5.2a2.9 2.9 0 1 1-5.8 0c0-1.2 1-2.9 2.9-5.2z"/>' +
    '<path d="M16.4 11.4c1.5 1.8 2.2 3.1 2.2 4.1a2.2 2.2 0 1 1-4.4 0c0-1 .7-2.3 2.2-4.1z"/>' +
    '<path d="M3.5 20.5 20.5 3.5"/>',

  /** An engine block with an intake. */
  engine:
    '<rect x="3.5" y="10" width="12" height="7.5" rx="1.5"/>' +
    '<path d="M15.5 12.2h2.2l2.8 2.6v2.7h-5"/>' +
    '<path d="M6.5 10V7.2h4.5V10"/><path d="M8.5 7.2h4.5"/>',

  /** A shield protecting a bead of water. */
  shield:
    '<path d="M12 2.6 19.5 5.4v5.9c0 4.8-3.2 8.1-7.5 9.6-4.3-1.5-7.5-4.8-7.5-9.6V5.4z"/>' +
    '<path d="M12 8.6c1.7 2 2.5 3.3 2.5 4.4a2.5 2.5 0 1 1-5 0c0-1.1.8-2.4 2.5-4.4z"/>',

  /** A faceted gem: hard, glass-like, permanent. */
  gem:
    '<path d="M6.5 3.5h11l3 5-8.5 12L3.5 8.5z"/>' +
    '<path d="M3.5 8.5h17"/><path d="M9.7 8.5 12 3.7l2.3 4.8L12 20.5"/>',

  /** A rotary polisher head. */
  polisher:
    '<circle cx="10" cy="14" r="5.8"/><circle cx="10" cy="14" r="2.2"/>' +
    '<path d="M14.3 10.1 17.8 6.6l3.1 3.1-3.5 3.5"/>',

  /** A polisher lifting swirl marks out of the paint. */
  correct:
    '<circle cx="9.2" cy="14.6" r="5.4"/>' +
    '<path d="M13.2 10.8 17 7"/><path d="M15.2 5 19 8.8"/>' +
    '<path d="M6 12.8c1.4 1.1 3.2 1.1 4.6 0"/>' +
    '<path d="M6.4 16.6c1.4 1.1 3.2 1.1 4.6 0"/>',
};

/** Falls back to a neutral dot rather than rendering nothing. */
export function addonIcon(name: string | undefined): string {
  return (name && ADDON_ICONS[name]) || '<circle cx="12" cy="12" r="8.5"/>';
}
