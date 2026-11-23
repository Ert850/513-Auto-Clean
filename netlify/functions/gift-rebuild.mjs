import { GIFT_CARDS, cincinnatiDay } from "./_pricing.mjs";

/**
 * Rebuilds the site on the morning the gift card sale starts, the morning
 * after it ends, and the day next year's dates (sale.next) come, so the
 * page's own HTML (what search engines and a slow phone see first) matches
 * the prices the checkout charges. The page's script
 * already corrects itself in the browser; this makes the source right too
 * (validation pass 1).
 *
 * Needs GIFT_REBUILD_HOOK: a Netlify build hook URL (Site configuration,
 * Build hooks). Without it, nothing happens. Runs daily just after midnight
 * Cincinnati time (netlify.toml); scheduled functions run only on the
 * published site.
 */
export function rebuildDue(cfg, nowMs) {
  if (cfg.mode !== "sale") return false;
  const today = cincinnatiDay(nowMs);
  const dayAfterEnd = cincinnatiDay(Date.parse(cfg.sale.ends + "T12:00:00Z") + 86_400_000);
  // And on the day next year's dates arrive: the "next sale runs..." line comes off.
  return today === cfg.sale.starts || today === dayAfterEnd || today === cfg.sale.next?.starts;
}

export async function handler() {
  const hook = process.env.GIFT_REBUILD_HOOK;
  if (!hook || !/^https:\/\/api\.netlify\.com\/build_hooks\/[A-Za-z0-9]+$/.test(hook)) return { statusCode: 200, body: "no hook" };
  if (!rebuildDue(GIFT_CARDS, Date.now())) return { statusCode: 200, body: "not today" };
  try {
    const r = await fetch(hook + "?trigger_title=gift%20card%20sale%20dates", { method: "POST" });
    console.log("gift-rebuild", r.status);
    return { statusCode: 200, body: "rebuild " + r.status };
  } catch (err) {
    console.error("gift-rebuild", String(err?.message || err).slice(0, 200));
    return { statusCode: 500, body: "failed" };
  }
}
