// Entry point used only at build time, to pre-render public pages into HTML
// (see app.routes.server.ts). The live site is still static files.
export { AppServerModule as default } from './app/app.module.server';
