/** Recommended source-image sizes for every upload point in the admin
 * panel. Derived from how large each image actually displays on the
 * public site (site/static/css/layout.css): the article main image/hero
 * shows at up to ~884px wide (16:9), the avatar at up to 140px (1:1) —
 * these targets give roughly 1.3–2.8x headroom over that for sharpness on
 * retina displays, without being needlessly huge. Purely informational
 * (shown as guidance + a live crop-output readout), not enforced — an
 * admin can still upload smaller if that's genuinely all they have. */
export interface RecommendedSize {
  width: number;
  height: number;
  label: string;
}

export const ARTICLE_IMAGE_SIZE: RecommendedSize = { width: 1200, height: 675, label: '16:9' };
export const AVATAR_SIZE: RecommendedSize = { width: 400, height: 400, label: 'square' };
// Standard Facebook/X link-share preview ratio (1.91:1) — used wherever an
// image needs to render well as an og:image/twitter:image fallback.
export const SHARE_IMAGE_SIZE: RecommendedSize = { width: 1200, height: 630, label: 'social share' };
// The Media Library / CKEditor body images have no fixed aspect — displays
// up to the article body column's width (~880px) — so only a minimum
// long-edge is recommended, not a fixed width+height pair.
export const MEDIA_MIN_LONG_EDGE = 800;

export function formatRecommendedSize(size: RecommendedSize): string {
  return `${size.width}×${size.height}px (${size.label})`;
}
