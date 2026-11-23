import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { animate, inView, stagger } from 'motion';
import { isBrowser, reducedMotion } from './motion-env';

/**
 * Blur-in heading (after Motion Primitives' Text Effect, "blur" preset): the
 * words fade in from a soft blur, one after another, when it scrolls into view.
 * Keeps inline markup such as <em>.
 */
@Directive({ selector: '[appBlurIn]', standalone: false })
export class BlurInDirective implements AfterViewInit, OnDestroy {
  private stop?: () => void;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (!isBrowser() || reducedMotion()) return;
    this.zone.runOutsideAngular(() => {
      const el = this.host.nativeElement;
      const words = splitWords(el);
      if (!words.length) return;
      words.forEach(w => { w.style.opacity = '0'; w.style.filter = 'blur(10px)'; w.style.transform = 'translateY(0.18em)'; });
      this.stop = inView(el, () => {
        animate(words, { opacity: [0, 1], filter: ['blur(10px)', 'blur(0px)'], transform: ['translateY(0.18em)', 'translateY(0em)'] },
          { duration: 0.7, delay: stagger(0.05), ease: [0.22, 1, 0.36, 1] });
      }, { amount: 0.4 });
    });
  }

  ngOnDestroy(): void { this.stop?.(); }
}

/** Wrap each word in an inline-block span (keeps element children such as <em>). */
function splitWords(root: HTMLElement): HTMLElement[] {
  const words: HTMLElement[] = [];
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent || '').split(/(\s+)/);
        if (!parts.some(p => p.trim())) return;
        const frag = document.createDocumentFragment();
        parts.forEach(part => {
          if (!part) return;
          if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span');
          s.className = 'wl-word';
          s.textContent = part;
          frag.appendChild(s);
          words.push(s);
        });
        child.parentNode!.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName !== 'BR') {
        walk(child);
      }
    });
  };
  walk(root);
  return words;
}
