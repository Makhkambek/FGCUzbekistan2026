/**
 * The event's background, shared by the public board and every projector
 * screen so they read as one event rather than three separate pages.
 */
export const EVENT_BACKGROUND =
  'linear-gradient(158deg, oklch(0.58 0.27 348) 0%, oklch(0.63 0.24 356) 26%, '
  + 'oklch(0.7 0.17 30) 52%, oklch(0.68 0.15 235) 78%, oklch(0.62 0.17 244) 100%)';

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
