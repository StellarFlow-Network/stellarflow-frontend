/**
 * SvgSprite — loads the global external SVG symbol sheet from /public/static/sprite.svg
 *
 * Mount this ONCE at the root layout. All icon consumers reference symbols
 * via <use xlink:href="/static/sprite.svg#icon-*"> which eliminates duplicate inline SVG weight
 * across high-density table views and leverages browser caching.
 *
 * Adding a new icon: append a <symbol> to /public/static/sprite.svg and add its id to ICON_IDS in
 * `./iconIds.ts`. Keeping the sprite sheet as a static file allows the browser to cache it
 * independently of the JavaScript bundle.
 */
import { ICON_IDS } from "./iconIds";
export { ICON_IDS } from "./iconIds";
export type { IconId } from "./iconIds";

export default function SvgSprite() {
  // The actual sprite sheet is hosted as a static file at /static/sprite.svg
  // This component remains as a marker in the root layout for backwards compatibility
  // and to maintain the existing import pattern
  return null;
}
