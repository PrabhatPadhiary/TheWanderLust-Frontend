/** Shared checks for the motion pieces (all are browser-only and respect reduced motion). */
export const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
export const reducedMotion = () => isBrowser() && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** A real mouse or trackpad (not touch): hover-driven effects only run here. */
export const finePointer = () => isBrowser() && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
