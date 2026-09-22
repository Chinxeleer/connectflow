/**
 * The "ENC" wordmark, cropped from the org-supplied `public/Logo.svg` (which
 * ships with a lot of transparent canvas around the actual mark — too much
 * to read at icon size, hence the pre-cropped `logo-mark.png`). A plain
 * `<img>`, not an SVG component: the source art is a raster image, so there
 * are no paths here to recolor or animate.
 */
export function Logo({ className }: { className?: string }) {
	return <img src="/logo-mark.png" alt="" className={className} />;
}
