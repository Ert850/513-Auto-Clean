/**
 * Minimal typings for the plain-JavaScript Netlify functions, so the smoke
 * test can import them under strict TypeScript.
 */
declare module "*/_ratelimit.mjs" {
  export function limited(event: unknown, name: string, perMinute: number): boolean;
  export function resetRateLimits(): void;
}
