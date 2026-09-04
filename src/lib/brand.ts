/**
 * The projector's ground: the deep navy the FGC display reference files use.
 *
 * A hall is a hard place to read a screen. Against navy the alliance reds and
 * blues separate and the white score carries to the back wall; against the
 * event gradient they sit on colours of similar weight, and a projector in a
 * lit room washes a light ground out altogether.
 */
export const BROADCAST_BACKGROUND =
  'linear-gradient(160deg, oklch(0.21 0.05 250) 0%, oklch(0.26 0.07 255) 55%, '
  + 'oklch(0.19 0.05 250) 100%)';

/** Faint grid laid over a gradient, so a large flat area does not band. */
export function gridTexture(opacity: number): React.CSSProperties {
  return {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage:
      `linear-gradient(oklch(1 0 0 / ${opacity}) 1px, transparent 1px), `
      + `linear-gradient(90deg, oklch(1 0 0 / ${opacity}) 1px, transparent 1px)`,
    backgroundSize: '96px 96px',
  };
}
