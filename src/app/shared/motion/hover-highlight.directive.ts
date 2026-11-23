import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';
import { finePointer, isBrowser, reducedMotion } from './motion-env';

/**
 * Sliding highlight (after Motion Primitives' Animated Background): one pill
 * behind a group of links or buttons that slides to the one you point at
 * (mode "hover"), to the active one ("active"), or both ("both": it rests on
 * the active one and follows the pointer). Styles: `.wl-hl` in _motion.scss;
 * colour from --wl-hl-bg on the host.
 */
@Directive({ selector: '[appHoverHighlight]', standalone: false })
export class HoverHighlightDirective implements AfterViewInit, OnDestroy {
  @Input() appHoverHighlight: 'hover' | 'active' | 'both' | '' = '';
  /** The items in the group. */
  @Input() highlightItems = 'a, button';
  /** The class that marks the active item. */
  @Input() highlightActive = 'active';
  private off: (() => void)[] = [];

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (!isBrowser()) return;
    const mode = this.appHoverHighlight || 'hover';
    const host = this.host.nativeElement;
    host.classList.add('wl-hl-host');
    const pill = document.createElement('span');
    pill.className = 'wl-hl';
    pill.setAttribute('aria-hidden', 'true');
    host.prepend(pill);
    if (reducedMotion()) pill.classList.add('wl-hl--still');

    const items = () => Array.from(host.querySelectorAll<HTMLElement>(this.highlightItems));
    const active = () => items().find(i => i.classList.contains(this.highlightActive));
    let first = true;
    const to = (el?: HTMLElement | null) => {
      if (!el) { pill.style.opacity = '0'; return; }
      // Jump (no slide) the first time it shows, then slide from there.
      if (first || pill.style.opacity === '0') pill.classList.add('wl-hl--jump');
      pill.style.width = `${el.offsetWidth}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
      pill.style.opacity = '1';
      if (pill.classList.contains('wl-hl--jump')) { pill.getBoundingClientRect(); pill.classList.remove('wl-hl--jump'); }
      first = false;
    };
    const rest = () => to(mode === 'hover' ? null : active());

    this.zone.runOutsideAngular(() => {
      const over = (e: Event) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>(this.highlightItems);
        if (el && host.contains(el)) to(el);
      };
      if (mode !== 'active' && finePointer()) {
        host.addEventListener('pointerover', over);
        host.addEventListener('pointerleave', rest);
        this.off.push(() => { host.removeEventListener('pointerover', over); host.removeEventListener('pointerleave', rest); });
      }
      if (mode !== 'hover') {
        // Follow the active item as it changes (a class on one of the items).
        // (the pill's own class changes are ignored, or it would chase itself)
        const mo = new MutationObserver(list => { if (list.some(m => m.target !== pill)) rest(); });
        mo.observe(host, { subtree: true, attributes: true, attributeFilter: ['class'] });
        const ro = new ResizeObserver(rest);
        ro.observe(host);
        this.off.push(() => { mo.disconnect(); ro.disconnect(); });
        requestAnimationFrame(rest);
      }
    });
  }

  ngOnDestroy(): void { this.off.forEach(f => f()); }
}
