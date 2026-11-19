import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Which pages are built into finished HTML at build time (so search engines
 * and AI tools can read them without running JavaScript), and which are left
 * to the browser.
 *
 * Pre-render only pages whose content is the same for everyone and changes
 * only when we deploy. Signed-in pages and pages that load data from the API
 * (community, destinations, stories) stay client-side.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'features', renderMode: RenderMode.Prerender },
  { path: 'pricing', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'download', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
  { path: 'delete-account', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
