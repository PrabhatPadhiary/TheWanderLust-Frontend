import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router } from '@angular/router';

/** What a page tells search engines and link previews about itself. */
export interface PageSeo {
  title: string;
  description?: string;
  /** Path for the canonical link (defaults to the current path, without query or fragment). */
  path?: string;
  /** Absolute image URL for link previews (defaults to the Wayraa preview image). */
  image?: string;
  /** Keep the page out of search results (signed-in pages, private stories). */
  noindex?: boolean;
  /** 'website' for pages, 'article' for stories. */
  type?: 'website' | 'article';
}

const SITE = 'https://wayraa.com';
const DEFAULT_IMAGE = `${SITE}/assets/images/og/wayraa-og.jpg`;
const DEFAULT_DESCRIPTION =
  'Plan trips together: find stays, food and things to do, plan every day on a map, share one plan with your friends, and keep the budget and checklist in one place. Free on the web and Android.';

/**
 * Sets each page's title, description, canonical link, robots and link-preview
 * (Open Graph / Twitter) tags.
 *
 * Static pages declare theirs in the route table as `data: { seo: {...} }`
 * (applied on every navigation). Pages whose details come from the server
 * (stories, destinations) call `set()` once the data has loaded.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private title: Title,
    private meta: Meta,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(DOCUMENT) private doc: Document,
  ) {}

  /** True once the current page has set its own SEO (the route's defaults then step aside). */
  private pageSet = false;

  /** Start applying route-level SEO on every navigation (call once, from the root component). */
  init(): void {
    this.router.events.subscribe(e => {
      if (e instanceof NavigationStart) {
        this.pageSet = false;
        this.setJsonLd(null);
      }
      if (e instanceof NavigationEnd && !this.pageSet) {
        let r = this.route;
        while (r.firstChild) r = r.firstChild;
        const seo: PageSeo | undefined = r.snapshot.data['seo'];
        if (seo) this.apply(seo);
      }
    });
  }

  /** A page's own SEO (e.g. from loaded data); wins over the route's defaults. */
  set(seo: PageSeo): void {
    this.pageSet = true;
    this.apply(seo);
  }

  private apply(seo: PageSeo): void {
    const title = seo.title;
    const description = (seo.description || DEFAULT_DESCRIPTION).slice(0, 300);
    const path = seo.path ?? this.router.url.split(/[?#]/)[0];
    const url = SITE + (path === '/' ? '/' : path.replace(/\/$/, ''));
    const image = seo.image || DEFAULT_IMAGE;

    this.title.setTitle(title);
    this.tag('name', 'description', description);
    this.tag('name', 'robots', seo.noindex ? 'noindex, nofollow' : 'index, follow');
    this.tag('property', 'og:type', seo.type || 'website');
    this.tag('property', 'og:title', title);
    this.tag('property', 'og:description', description);
    this.tag('property', 'og:url', url);
    this.tag('property', 'og:image', image);
    this.tag('name', 'twitter:title', title);
    this.tag('name', 'twitter:description', description);
    this.tag('name', 'twitter:image', image);
    this.canonical(seo.noindex ? null : url);
  }

  /** Page-specific structured data (e.g. a story's Article), or null to remove it. */
  setJsonLd(data: object | null): void {
    this.doc.getElementById('page-jsonld')?.remove();
    if (!data) return;
    const s = this.doc.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'page-jsonld';
    s.text = JSON.stringify(data);
    this.doc.head.appendChild(s);
  }

  private tag(attr: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attr]: key, content } as any, `${attr}="${key}"`);
  }

  /** One canonical link, pointing at this page (removed on noindex pages). */
  private canonical(url: string | null): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) { link?.remove(); return; }
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = url;
  }
}
