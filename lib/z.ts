/**
 * The page's complete z-index scale. Every stacking decision is made here so
 * that no component reaches for an arbitrary value.
 */
export const z = {
  /** Decorative washes and the ambient arc. Below all content. */
  atmosphere: 0,
  /** Normal page content. */
  content: 10,
  /** Captions and badges sitting over imagery. */
  overlay: 20,
  /** The sticky header. */
  nav: 40,
  /** The mobile navigation panel. */
  menu: 50,
} as const;
