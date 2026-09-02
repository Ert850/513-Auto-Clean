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
