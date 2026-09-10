import type { ServiceCategory } from "../pricing/quote.js";

/**
 * A single unit of work, "shampoo upholstery", "ceramic sealant applied".
 *
 * Packages are COMPOSITIONS of these rather than flat priced rows, because
 * customers can add or remove individual parts of a package. Modelling this
 * from the start avoids a rewrite: retrofitting composition onto flat rows
 * would mean re-deriving every historical booking's contents.
 */
export interface ServiceComponent {
  id: string;
  /** Customer-facing wording. Appears verbatim in the package feature list. */
  name: string;
  category: ServiceCategory;
  /** Hands-on minutes this contributes to the job. */
  durationMin: number;
  /**
   * What this component is worth on its own, for add/remove customization.
   *
   * NULL means "not individually priced yet". A component with a null value is
   * shown in the feature list but CANNOT be added or removed, because guessing
   * a number here would either overcharge a customer or quietly erode a margin.
   * Elijah sets these in the admin panel; see PENDING_COMPONENT_PRICING.
   */
  valueCents: number | null;
  /** Cost of consumables, for margin tracking. Null until measured. */
  materialsCostCents: number | null;
  /**
   * False for work that defines the package and cannot be stripped out,
   * you cannot remove "hand wash" from an exterior detail and still have one.
   */
  removable: boolean;
  /**
   * Short clip showing this step being done. Reserved for the (i) markers
   * Elijah's editor will film later. Nothing renders one yet: keeping the
   * field here means adding them is a data change, not a template change.
   */
  videoUrl?: string;
}

export interface Package {
  id: string;
  slug: string;
  name: string;
  category: ServiceCategory;
  tagline: string;
  /**
   * The headline price. Deliberately NOT the sum of its components: a package
   * is a bundle priced below the sum of its parts, which is the whole reason
   * removing a component refunds less than that component's full value.
   */
  priceCents: number;
  durationMin: number;
  componentIds: string[];
  featured: boolean;
  sortOrder: number;
  /** Upper bound where a package is quoted as a range, e.g. 6 to 8 hours. */
  durationMaxMin?: number;
  /**
   * Render the price as "$395+" rather than "$395".
   *
   * Showroom Ready is priced from a floor and settles on inspection. It earns
   * its place mostly as a high anchor that makes Full read as the sensible
   * choice, so the plus has to be visible rather than buried in fine print.
   */
  pricePlus?: boolean;
  /**
   * Set when this package contains every component of another, so the UI can
   * say "everything in Full, plus" rather than repeating the whole list.
   */
  supersetOf?: string;
  /**
   * Gate for returning-customer pricing. The Maintenance package is only
   * offered when the customer's previous detail falls inside this window.
   */
  requiresPriorDetail?: { minMonths: number; maxMonths: number };
  /**
   * The customer must pick a correction or coating tier before this package
   * can be priced. See CORRECTION_TIERS in ./addons.ts.
   */
  requiresCorrectionTier?: boolean;
  /**
   * Listed, explained and priced, but not bookable yet.
   *
   * Shown with a way to register interest rather than hidden, because hiding
   * a service hides the demand for it. A customer ticks it, books whatever
   * they came for, and Elijah learns how many people wanted the thing he has
   * not launched.
   */
  comingSoon?: boolean;
  comingSoonNote?: string;
  /**
   * Minutes to reserve on the calendar, when that differs from the quoted
   * duration. Correction work runs across several days, so only the first is
   * scheduled and the rest is arranged directly; booking 30 hours as one
   * block would swallow a fortnight of availability.
   */
  schedulingDurationMin?: number;
  /** See ServiceComponent.videoUrl. Reserved for the (i) markers. */
  videoUrl?: string;
  /**
   * Plain "how it works" for the customer, behind a toggle on the card.
   *
   * Always says what the tier does NOT cover as well as what it does. Setting
   * that expectation before the job is far cheaper than arguing about it
   * afterwards, and it points people at the right tier instead of the
   * cheapest one they hoped would be enough.
   */
  note?: string;
}

export interface Catalog {
  components: Record<string, ServiceComponent>;
  packages: Package[];
}

/** Look up a package's components in listed order. */
export function componentsOf(pkg: Package, catalog: Catalog): ServiceComponent[] {
  return pkg.componentIds
    .map((id) => catalog.components[id])
    .filter((c): c is ServiceComponent => c !== undefined);
}

/** Components a customer may actually remove: removable AND individually priced. */
export function removableComponents(pkg: Package, catalog: Catalog): ServiceComponent[] {
  return componentsOf(pkg, catalog).filter((c) => c.removable && c.valueCents !== null);
}

/** Components not already in the package that could be added onto it. */
export function addableComponents(pkg: Package, catalog: Catalog): ServiceComponent[] {
  const present = new Set(pkg.componentIds);
  return Object.values(catalog.components).filter(
    (c) => !present.has(c.id) && c.valueCents !== null && c.category === pkg.category,
  );
}

/**
 * Every component still missing a price, so the admin panel can show a
 * "finish pricing these before enabling customization" checklist rather than
 * failing silently.
 */
export function unpricedComponents(catalog: Catalog): ServiceComponent[] {
  return Object.values(catalog.components).filter((c) => c.valueCents === null);
}
